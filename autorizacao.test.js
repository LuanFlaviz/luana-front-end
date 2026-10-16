// Testes da "Finalizar autorização" da versão 2.0.
// Carrega index.html + script.js num DOM simulado (jsdom), sem rede.
// Pasta do projeto: variável PROJETO (padrão = cópia ajustada).
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const PROJETO =
  process.env.PROJETO || '/home/claude/luana-2.0-ajustada/Painel-de-Estoque-Luana';

function abrir(estoque, nomes, receitas, { abrirConta = true } = {}) {
  const seed = {
    stockDatabase: estoque,
    nextStockId: 100,
    productNames: nomes,
    receitas,
    nextProductId: 100,
    historicoMovimentacoes: [],
  };
  const html = fs
    .readFileSync(path.join(PROJETO, 'index.html'), 'utf8')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<link[^>]*>/gi, '');
  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    beforeParse(window) {
      window.structuredClone = global.structuredClone;
      for (const [k, v] of Object.entries(seed)) window.localStorage.setItem(k, JSON.stringify(v));
      window.SUPABASE_CONFIG = {
        url: 'https://supabase.test',
        anonKey: 'test-publishable-key',
        allowGuestPreview: true,
        startInGuestPreview: false,
      };
      window.supabase = {
        createClient() {
          return {
            auth: {
              onAuthStateChange() {},
              async getSession() {
                return { data: { session: null }, error: null };
              },
              async signInWithPassword() {
                return { data: { session: null }, error: null };
              },
              async signOut() {
                return { error: null };
              },
            },
          };
        },
      };
      const D = window.HTMLDialogElement;
      if (D && !D.prototype.showModal) {
        D.prototype.showModal = function () { this.setAttribute('open', ''); };
        D.prototype.close = function () { this.removeAttribute('open'); };
      }
    },
  });
  // vm.Script no contexto do jsdom: os "const" do script.js continuam visíveis depois
  const ctx = dom.getInternalVMContext();
  const rodar = (codigo) => new vm.Script(codigo).runInContext(ctx);
  rodar(fs.readFileSync(path.join(PROJETO, 'script.js'), 'utf8'));
  dom.window.__run = rodar;
  if (abrirConta) {
    rodar("abrirAplicacao({ id: 'test-user', email: 'teste@example.com' })");
  }
  return dom.window;
}

const autorizar = (w, qtds) => {
  w.__run(`state.autorizacao = ${JSON.stringify(qtds)}; renderAutorizacao();`);
  w.document.querySelector('#btnFinalizar').click();
};
const estoqueSalvo = (w) => JSON.parse(w.localStorage.getItem('luana:test-user:stockDatabase'));
const historicoSalvo = (w) => JSON.parse(w.localStorage.getItem('luana:test-user:historicoMovimentacoes') || '[]');
const titulo = (w) => w.document.querySelector('#dialogResumoTitulo').textContent;
const impedimentos = (w) =>
  [...w.document.querySelectorAll('#resumoAvisosLista li')].map((li) => li.textContent);
const avisosVisiveis = (w) => !w.document.querySelector('#resumoAvisos').hidden;
const pendentes = (w) => Object.keys(w.__run('state.autorizacao'));

const farinha = (qtd, unit = 'Kg') => ({ id: 1, name: 'FARINHA', quantity: qtd, unit });

test('sucesso: debita o estoque, grava histórico e limpa a lista', () => {
  const w = abrir([farinha(10)], { 1: 'COXINHA' }, { 1: { FARINHA: { quantity: 500, unit: 'g' } } });
  autorizar(w, { 1: 4 });
  assert.equal(estoqueSalvo(w)[0].quantity, 8);
  assert.deepEqual(historicoSalvo(w).map((m) => m.tipo), ['Produção autorizada', 'Saída do estoque']);
  assert.equal(titulo(w), 'Autorização finalizada');
  assert.equal(avisosVisiveis(w), false);
  assert.equal(pendentes(w).length, 0);
});

test('estoque insuficiente: não debita, não grava histórico, mantém a lista e mostra o que falta', () => {
  const w = abrir([farinha(1)], { 1: 'COXINHA' }, { 1: { FARINHA: { quantity: 500, unit: 'g' } } });
  autorizar(w, { 1: 4 }); // precisa de 2 Kg, tem 1
  assert.equal(estoqueSalvo(w)[0].quantity, 1);
  assert.equal(historicoSalvo(w).length, 0);
  assert.equal(titulo(w), 'Autorização não finalizada');
  assert.equal(avisosVisiveis(w), true);
  assert.match(impedimentos(w)[0], /FARINHA.*disponível 1,00 Kg.*necessário 2,00 Kg.*faltam 1,00 Kg/);
  assert.deepEqual(pendentes(w), ['1']);
});

test('soma receitas do mesmo ingrediente em g e kg antes de comparar com o saldo', () => {
  const w = abrir(
    [farinha(1)],
    { 1: 'COXINHA', 2: 'PASTEL' },
    { 1: { FARINHA: { quantity: 600, unit: 'g' } }, 2: { FARINHA: { quantity: 0.6, unit: 'kg' } } },
  );
  autorizar(w, { 1: 1, 2: 1 }); // cada um cabe (0,6 Kg), juntos não (1,2 Kg)
  assert.equal(estoqueSalvo(w)[0].quantity, 1);
  assert.equal(historicoSalvo(w).length, 0);
  assert.match(impedimentos(w)[0], /necessário 1,20 Kg/);
});

test('soma em g e kg quando o saldo é suficiente', () => {
  const w = abrir(
    [farinha(2)],
    { 1: 'COXINHA', 2: 'PASTEL' },
    { 1: { FARINHA: { quantity: 600, unit: 'g' } }, 2: { FARINHA: { quantity: 0.6, unit: 'kg' } } },
  );
  autorizar(w, { 1: 1, 2: 1 });
  assert.equal(estoqueSalvo(w)[0].quantity, 0.8);
  assert.equal(titulo(w), 'Autorização finalizada');
});

test('ingrediente da receita que não está no estoque bloqueia a autorização', () => {
  const w = abrir([farinha(10)], { 1: 'BOLO' }, {
    1: { FARINHA: { quantity: 100, unit: 'g' }, OVO: { quantity: 2, unit: 'un' } },
  });
  autorizar(w, { 1: 1 });
  assert.equal(estoqueSalvo(w)[0].quantity, 10); // a farinha também não foi debitada
  assert.equal(historicoSalvo(w).length, 0);
  assert.match(impedimentos(w)[0], /OVO não está no estoque/);
});

test('unidade da receita incompatível com a do estoque bloqueia a autorização', () => {
  const w = abrir([{ id: 1, name: 'SAL', quantity: 5, unit: 'Un' }], { 1: 'BOLO' }, {
    1: { SAL: { quantity: 10, unit: 'g' } },
  });
  autorizar(w, { 1: 1 });
  assert.equal(estoqueSalvo(w)[0].quantity, 5);
  assert.match(impedimentos(w)[0], /SAL: a receita usa g, mas o estoque está em Un/);
});

test('depois de repor o estoque, a mesma autorização pode ser finalizada', () => {
  const w = abrir([farinha(1)], { 1: 'COXINHA' }, { 1: { FARINHA: { quantity: 500, unit: 'g' } } });
  autorizar(w, { 1: 4 });
  assert.equal(titulo(w), 'Autorização não finalizada');
  w.__run('state.estoque[0].quantity = 10; salvarEstoque();');
  w.document.querySelector('#btnFinalizar').click();
  assert.equal(estoqueSalvo(w)[0].quantity, 8);
  assert.equal(titulo(w), 'Autorização finalizada');
  assert.equal(pendentes(w).length, 0);
});

test('dashboard soma produção e consumo e filtra por tipo e volume', () => {
  const w = abrir([], {}, {});
  w.__run(`state.historico = ${JSON.stringify([
    { tipo: 'Produção autorizada', item: 'COXINHA', quantidade: 4, unidade: 'un' },
    { tipo: 'Produção autorizada', item: 'COXINHA', quantidade: 2, unidade: 'un' },
    { tipo: 'Saída do estoque', item: 'FARINHA', quantidade: 1.5, unidade: 'Kg' },
    { tipo: 'Saída do estoque', item: 'FARINHA', quantidade: 0.5, unidade: 'Kg' },
    { tipo: 'Saída do estoque', item: 'SAL', quantidade: 3, unidade: 'Kg' },
  ])}; renderDashboard();`);

  assert.equal(w.document.querySelector('#totalProduzido').textContent, '6 unidade(s)');
  assert.equal(w.document.querySelector('#totalConsumido').textContent, '5,00 Kg');
  assert.equal(w.document.querySelectorAll('#listaDashboard > li').length, 3);

  w.__run(`document.querySelector('#dashboardTipo').value = 'ingredientes';
    document.querySelector('#dashboardOrdem').value = 'menos'; renderDashboard();`);
  assert.equal(w.document.querySelectorAll('#listaDashboard > li').length, 2);
  assert.match(w.document.querySelector('#listaDashboard > li').textContent, /FARINHA/);

  w.__run(`document.querySelector('#dashboardTipo').value = 'produtos'; renderDashboard();`);
  assert.equal(w.document.querySelectorAll('#listaDashboard > li').length, 1);
  assert.match(w.document.querySelector('#listaDashboard > li').textContent, /6 un/);
});

test('prévia local abre as telas sem login e mantém o aviso de acesso aberto', () => {
  const w = abrir([], {}, {}, { abrirConta: false });
  assert.equal(w.document.querySelector('#authScreen').hidden, false);
  assert.equal(w.document.querySelector('#appRoot').hidden, true);
  assert.equal(w.document.querySelector('#btnAcessarPrevia').hidden, false);
  w.document.querySelector('#btnAcessarPrevia').click();

  assert.equal(w.document.querySelector('#authScreen').hidden, true);
  assert.equal(w.document.querySelector('#appRoot').hidden, false);
  assert.equal(w.document.querySelector('#painel-dashboard').hidden, false);
  assert.equal(w.document.querySelector('#previewBanner').hidden, false);

  w.document.querySelector('#btnSair').click();
  assert.equal(w.document.querySelector('#authScreen').hidden, false);
  assert.equal(w.document.querySelector('#appRoot').hidden, true);
});

test('QR de produtos é interpretado e URL de NFC-e fica para conferência por foto', () => {
  const w = abrir([], {}, {});
  const itens = JSON.parse(w.__run(`JSON.stringify(extrairItensQrCompra(JSON.stringify({
    items: [{ name: 'Farinha', quantity: 500, unit: 'g' }]
  })))`));
  assert.deepEqual(itens, [{ nome: 'Farinha', quantidade: 0.5, unidade: 'Kg' }]);
  assert.deepEqual(JSON.parse(w.__run(`JSON.stringify(extrairItensQrCompra(
    'https://consulta-fiscal.exemplo/qr?p=chave'
  ))`)), []);

  const xml = '<NFe><det><prod><xProd>Queijo</xProd><qCom>2</qCom><uCom>KG</uCom></prod></det></NFe>';
  assert.deepEqual(
    JSON.parse(w.__run(`JSON.stringify(extrairItensQrCompra(${JSON.stringify(xml)}))`)),
    [{ nome: 'Queijo', quantidade: 2, unidade: 'Kg' }],
  );
});

test('OCR sugere apenas nomes editáveis e entrada exige conferência dupla', () => {
  const w = abrir([farinha(1)], {}, {});
  const nomes = JSON.parse(w.__run(`JSON.stringify(nomesDaNotaPorOcr(
    '001 LEITE INTEGRAL 1L 4,99\\nTOTAL 4,99\\n002 ACUCAR CRISTAL 5,00'
  ))`));
  assert.deepEqual(nomes.map((item) => item.nome), ['LEITE INTEGRAL', 'ACUCAR CRISTAL']);
  assert.ok(nomes.every((item) => item.quantidade === ''));

  w.__run(`definirItensCompra([{ nome: 'FARINHA', quantidade: 0.5, unidade: 'Kg' }], 'do QR Code')`);
  const checkbox = w.document.querySelector('.purchase-checked input');
  checkbox.checked = true;
  checkbox.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(w.document.querySelector('#btnConfirmarCompra').disabled, false);
  let confirmations = 0;
  w.confirm = () => {
    confirmations++;
    return true;
  };
  w.document.querySelector('#btnConfirmarCompra').click();

  assert.equal(confirmations, 2);
  assert.equal(estoqueSalvo(w)[0].quantity, 1.5);
  assert.equal(historicoSalvo(w).at(-1).tipo, 'Entrada no estoque');
});
