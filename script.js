/* =====================================================
       1. ARMAZENAMENTO (mesmas chaves das páginas antigas,
          então os dados já salvos continuam funcionando)
       ===================================================== */
const KEYS = {
  estoque: "stockDatabase",
  proximoIdEstoque: "nextStockId",
  receitas: "receitas",
  nomesProdutos: "productNames",
  proximoIdProduto: "nextProductId",
  historico: "historicoMovimentacoes",
};

const store = {
  storageKey(key) {
    return state.userId ? `luana:${state.userId}:${key}` : key;
  },
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(this.storageKey(key));
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.warn(`Falha ao ler "${key}":`, e);
      return fallback;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(this.storageKey(key), JSON.stringify(value));
    } catch (e) {
      console.warn(`Falha ao salvar "${key}":`, e);
    }
  },
  useAccount(userId) {
    const legacyKeys = Object.values(KEYS);
    const accountHasData = legacyKeys.some((key) =>
      localStorage.getItem(`luana:${userId}:${key}`),
    );
    if (!accountHasData) {
      for (const key of legacyKeys) {
        const legacyData = localStorage.getItem(key);
        if (legacyData !== null) {
          localStorage.setItem(`luana:${userId}:${key}`, legacyData);
          localStorage.removeItem(key);
        }
      }
    }
    state.userId = userId;
  },
};

const SUGESTOES_PADRAO = [
  "Arroz",
  "Feijão",
  "Macarrão",
  "Óleo",
  "Açúcar",
  "Sal",
  "Farinha de Trigo",
  "Café",
  "Leite",
  "Manteiga",
  "Queijo",
  "Carne Bovina",
  "Frango",
  "Peixe",
  "Legumes",
  "Frutas",
];

const PRODUTOS_PADRAO = {
  nomes: { 1: "SALGADOS FRITOS", 2: "SALGADOS ASSADOS" },
  receitas: {
    1: {
      FARINHA: { quantity: 1000, unit: "g" },
      QUEIJO: { quantity: 500, unit: "g" },
      ÓLEO: { quantity: 0.5, unit: "L" },
    },
    2: {
      FARINHA: { quantity: 800, unit: "g" },
      RECHEIO: { quantity: 400, unit: "g" },
    },
  },
};

/* =====================================================
       2. ESTADO ÚNICO (compartilhado pelos dois painéis)
       ===================================================== */
const state = {
  userId: null,
  estoque: [],
  proximoIdEstoque: 1,
  nomes: {},
  receitas: {},
  proximoIdProduto: 1,
  historico: [], // lista de movimentações, da mais antiga para a mais nova
  autorizacao: {}, // { idProduto: quantidade } — só em memória, como antes
};

function proximoId(salvo, idsExistentes) {
  const maior = idsExistentes.length ? Math.max(...idsExistentes) : 0;
  return Math.max(parseInt(salvo, 10) || 1, maior + 1);
}

function carregarEstado() {
  state.estoque = store.read(KEYS.estoque, []);
  state.proximoIdEstoque = proximoId(
    store.read(KEYS.proximoIdEstoque, 1),
    state.estoque.map((item) => Number(item.id)),
  );

  const nomes = store.read(KEYS.nomesProdutos, null);
  if (nomes === null) {
    state.nomes = structuredClone(PRODUTOS_PADRAO.nomes);
    state.receitas = structuredClone(PRODUTOS_PADRAO.receitas);
    salvarProdutos();
  } else {
    state.nomes = nomes;
    state.receitas = store.read(KEYS.receitas, {});
  }
  state.proximoIdProduto = proximoId(
    store.read(KEYS.proximoIdProduto, 1),
    Object.keys(state.nomes).map(Number),
  );
  state.historico = store.read(KEYS.historico, []);
}

function salvarEstoque() {
  store.write(KEYS.estoque, state.estoque);
  store.write(KEYS.proximoIdEstoque, state.proximoIdEstoque);
}

function salvarProdutos() {
  store.write(KEYS.nomesProdutos, state.nomes);
  store.write(KEYS.receitas, state.receitas);
  store.write(KEYS.proximoIdProduto, state.proximoIdProduto);
}

// Anota uma movimentação no histórico (usado pelo relatório em PDF)
function registrar(tipo, item, quantidade = null, unidade = "", detalhe = "") {
  state.historico.push({
    data: new Date().toISOString(),
    tipo,
    item,
    quantidade,
    unidade,
    detalhe,
  });
  store.write(KEYS.historico, state.historico);
  if (!$("#appRoot").hidden) renderDashboard();
}

/* =====================================================
       3. UTILITÁRIOS
       ===================================================== */
const $ = (seletor) => document.querySelector(seletor);

function criarIcone(nome) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "ui-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const caminhos = {
    edit: ["M4 16.5V20h3.5L19 8.5 15.5 5z", "m13.5 7 3.5 3.5"],
    storefront: [
      "M3 10h18l-1.5-6h-15z",
      "M5 10v10h14V10",
      "M9 20v-6h6v6",
      "M3 10a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0",
    ],
    warehouse: ["M3 10 12 3l9 7v10h-6v-7H9v7H3z"],
  };
  for (const d of caminhos[nome] || []) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

// Cria elementos sem innerHTML (evita quebrar a página com nomes que tenham aspas ou <tags>)
function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [chave, valor] of Object.entries(attrs)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (chave === "class") el.className = valor;
    else if (chave === "text") el.textContent = valor;
    else if (chave.startsWith("on")) el.addEventListener(chave.slice(2), valor);
    else el.setAttribute(chave, valor === true ? "" : valor);
  }
  el.append(...filhos.flat().filter((f) => f !== null && f !== undefined));
  return el;
}

const normalizar = (nome) =>
  String(nome || "")
    .trim()
    .toUpperCase();

function formatarQtd(qtd, unidade) {
  const fracionada = unidade === "Kg" || unidade === "L";
  return Number(qtd).toLocaleString("pt-BR", {
    minimumFractionDigits: fracionada ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function lerNumero(valor) {
  return parseFloat(String(valor).replace(",", "."));
}

// Converte a quantidade da receita (g, kg, ml, L, un) para a unidade do estoque (Kg, L, Un)
function converterParaEstoque(qtd, unidadeReceita, unidadeEstoque) {
  const r = String(unidadeReceita || "").toLowerCase();
  const s = String(unidadeEstoque || "").toLowerCase();
  const tabela = {
    kg: { g: 0.001, kg: 1 },
    l: { ml: 0.001, l: 1 },
    un: { un: 1 },
  };
  const fator = tabela[s]?.[r] ?? (r === s ? 1 : null);
  return fator === null ? null : qtd * fator;
}

const MAPA_UNIDADE_ESTOQUE = { g: "Kg", kg: "Kg", ml: "L", l: "L", un: "Un" };

let toastTimer;
let cameraStream = null;
let barcodeScanTimeout = null;
let tesseractWorker = null;
let itensCompraReconhecidos = [];

function avisar(mensagem, tipo = "ok") {
  const toast = $("#toast");
  toast.textContent = mensagem;
  toast.classList.toggle("is-erro", tipo === "erro");
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function atualizarSugestoes() {
  const nomesEstoque = state.estoque.map((item) => item.name);
  const extras = SUGESTOES_PADRAO.map(normalizar).filter(
    (n) => !nomesEstoque.includes(n),
  );
  $("#sugestoesIngredientes").replaceChildren(
    ...[...nomesEstoque, ...extras].map((nome) => h("option", { value: nome })),
  );
}

/* =====================================================
       4. PAINEL ESTOQUE
       ===================================================== */
function renderEstoque() {
  const lista = $("#listaEstoque");
  const filtro = normalizar($("#pesquisaPainel").value);
  const itens = state.estoque.filter((item) =>
    normalizar(item.name).includes(filtro),
  );
  lista.replaceChildren(...itens.map(linhaEstoque));
  $("#estoqueVazio").hidden = state.estoque.length > 0;
  $("#estoqueSemResultados").hidden =
    state.estoque.length === 0 || itens.length > 0;
  atualizarSugestoes();
}

function linhaEstoque(item) {
  const entrada = h("input", {
    type: "number",
    class: "field field--destaque",
    min: "0",
    step: item.unit === "Un" ? "1" : "any",
    placeholder: "0",
    "aria-label": `Quantidade a somar em ${item.name}`,
    onkeydown: (e) => {
      if (e.key === "Enter") somarEstoque(item.id, entrada);
    },
  });

  return h(
    "li",
    { class: "stock-row" + (Number(item.quantity) <= 0 ? " is-zerado" : "") },
    h("span", { class: "row-name", text: item.name }),
    h("span", {
      class: "qty-badge",
      text: `${formatarQtd(item.quantity, item.unit)} ${item.unit}`,
    }),
    entrada,
    h("button", {
      type: "button",
      class: "btn-round",
      text: "+",
      "aria-label": `Somar ao estoque de ${item.name}`,
      onclick: () => somarEstoque(item.id, entrada),
    }),
    h("button", {
      type: "button",
      class: "btn-remove",
      text: "×",
      "aria-label": `Excluir ${item.name} do estoque`,
      onclick: () => excluirIngrediente(item.id),
    }),
  );
}

function cadastrarIngrediente(evento) {
  evento.preventDefault();
  const nome = normalizar($("#novoIngredienteNome").value);
  const qtd = lerNumero($("#novoIngredienteQtd").value);
  const unidade = $("#novoIngredienteUnidade").value;

  if (!nome || isNaN(qtd) || qtd < 0) {
    avisar("Preencha o nome e uma quantidade inicial válida.", "erro");
    return;
  }
  if (state.estoque.some((item) => item.name === nome)) {
    avisar(`${nome} já está no estoque. Use o + da linha para somar.`, "erro");
    return;
  }

  state.estoque.push({
    id: state.proximoIdEstoque++,
    name: nome,
    quantity: qtd,
    unit: unidade,
  });
  salvarEstoque();
  registrar(
    "Cadastro de ingrediente",
    nome,
    qtd,
    unidade,
    "Quantidade inicial",
  );
  renderEstoque();

  evento.target.reset();
  evento.target.hidden = true;
  avisar(`${nome} adicionado ao estoque.`);
}

function somarEstoque(id, entrada) {
  const item = state.estoque.find((i) => i.id === id);
  const valor = lerNumero(entrada.value);
  if (!item) return;
  if (isNaN(valor) || valor <= 0) {
    avisar("Informe um valor positivo para somar.", "erro");
    entrada.focus();
    return;
  }
  item.quantity = +(Number(item.quantity) + valor).toFixed(4);
  salvarEstoque();
  registrar(
    "Entrada no estoque",
    item.name,
    valor,
    item.unit,
    `Novo total: ${formatarQtd(item.quantity, item.unit)} ${item.unit}`,
  );
  renderEstoque();
  avisar(
    `${item.name}: novo total ${formatarQtd(item.quantity, item.unit)} ${item.unit}.`,
  );
}

function unidadeCompraParaEstoque(unidade) {
  const chave = String(unidade || "").trim().toLowerCase();
  const aliasesUnidade = [
    "un",
    "und",
    "unid",
    "unidade",
    "pc",
    "pç",
    "peca",
    "peça",
    "pct",
    "pacote",
    "cx",
    "caixa",
    "fd",
    "fardo",
    "dz",
    "dúzia",
    "duzia",
  ];
  return MAPA_UNIDADE_ESTOQUE[chave] || (aliasesUnidade.includes(chave) ? "Un" : null);
}

function converterQuantidadeCompra(quantidade, unidadeOrigem, unidadeDestino) {
  if (unidadeDestino === "Un" && unidadeCompraParaEstoque(unidadeOrigem) === "Un") {
    return quantidade;
  }
  return converterParaEstoque(quantidade, unidadeOrigem, unidadeDestino);
}

function extrairItensQrCompra(conteudo) {
  const xmlItems = (xml) => {
    const documento = new DOMParser().parseFromString(xml, "application/xml");
    if (documento.querySelector("parsererror")) return [];
    const detalhes = [...documento.getElementsByTagName("*")].filter(
      (elemento) => elemento.localName === "det",
    );
    return detalhes.flatMap((detalhe) => {
      const texto = (seletor) =>
        [...detalhe.getElementsByTagName("*")]
          .find((elemento) => elemento.localName === seletor)
          ?.textContent?.trim();
      const nome = texto("xProd");
      const quantidade = Number(String(texto("qCom") || "").replace(",", "."));
      const unidadeOriginal = texto("uCom");
      const unidade = unidadeCompraParaEstoque(unidadeOriginal);
      if (!nome || !Number.isFinite(quantidade) || quantidade <= 0 || !unidade) return [];
      const convertido = converterQuantidadeCompra(quantidade, unidadeOriginal, unidade);
      return convertido === null ? [] : [{ nome, quantidade: convertido, unidade }];
    });
  };

  const jsonItems = (entrada) => {
    if (!entrada || typeof entrada !== "object") return [];
    const listas = Array.isArray(entrada)
      ? [entrada]
      : Object.entries(entrada)
          .filter(([chave, valor]) =>
            /^(items|itens|products|produtos|lines|det)$/i.test(chave) &&
            Array.isArray(valor),
          )
          .map(([, valor]) => valor);

    for (const lista of listas) {
      const itens = lista.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const nome =
          item.name || item.nome || item.product || item.produto ||
          item.description || item.descricao || item.xProd;
        const quantidadeRaw =
          item.quantity ?? item.quantidade ?? item.qty ?? item.qtd ?? item.qCom;
        const quantidade = Number(String(quantidadeRaw ?? "").replace(",", "."));
        const unidadeOriginal = item.unit || item.unidade || item.uCom || "un";
        const unidade = unidadeCompraParaEstoque(unidadeOriginal);
        if (!nome || !Number.isFinite(quantidade) || quantidade <= 0 || !unidade) return [];
        const convertido = converterQuantidadeCompra(quantidade, unidadeOriginal, unidade);
        return convertido === null
          ? []
          : [{ nome: String(nome).trim(), quantidade: convertido, unidade }];
      });
      if (itens.length) return itens;
    }
    return [];
  };

  const texto = String(conteudo || "").trim();
  if (!texto) return [];
  try {
    const dados = JSON.parse(texto);
    const itens = jsonItems(dados);
    if (itens.length) return itens;
    if (typeof dados === "string") {
      const itensAninhados = extrairItensQrCompra(dados);
      if (itensAninhados.length) return itensAninhados;
    }
  } catch {
    // QR de NFC-e normalmente contém uma URL, não a lista de itens.
  }
  if (/<(?:\w+:)?(?:nfeProc|NFe|det)\b/i.test(texto)) {
    return xmlItems(texto);
  }
  return [];
}

function nomesDaNotaPorOcr(texto) {
  const ignorar =
    /\b(total|subtotal|troco|dinheiro|credito|cr[eé]dito|debito|d[eé]bito|pix|cpf|cnpj|ie:|im:|chave|acesso|protocolo|consumidor|consulta|sefaz|nota fiscal|nf-?e|nfc-?e|imposto|desconto|pagamento|cart[aã]o|valor|quantidade|qtd|unidade|mercadoria|obrigado|volte sempre)\b/i;
  const nomes = new Set();
  for (const linhaBruta of String(texto || "").split(/\r?\n/)) {
    let linha = linhaBruta
      .replace(/^\s*\d{1,4}\s*[.)-]?\s*/, "")
      .replace(/\s+(?:R\$)?\s*\d+[,.]\d{2}\s*$/i, "")
      .replace(/\s+\d+(?:[,.]\d+)?\s*(?:un|und|kg|g|l|ml)\b.*$/i, "")
      .replace(/[\t|]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (linha.length < 3 || !/[a-záàâãéêíóôõúç]{3}/i.test(linha) || ignorar.test(linha)) {
      continue;
    }
    linha = linha.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N} .()/-]+$/gu, "").trim();
    if (linha.length >= 3) nomes.add(linha);
  }
  return [...nomes].map((nome) => ({ nome, quantidade: "", unidade: "Un" }));
}

function definirItensCompra(itens, origem) {
  itensCompraReconhecidos = itens.map((item) => ({
    nome: normalizar(item.nome),
    quantidade: item.quantidade ?? "",
    unidade:
      item.unidade ||
      state.estoque.find((estoque) => estoque.name === normalizar(item.nome))?.unit ||
      "Un",
  }));
  renderItensCompra();
  if (itensCompraReconhecidos.length) {
    atualizarStatusCamera(
      `${itensCompraReconhecidos.length} item(ns) reconhecido(s) ${origem}. Revise cada nome e quantidade.`,
    );
  } else {
    atualizarStatusCamera(
      origem === "no QR Code"
        ? "O QR Code não contém a lista de produtos (isso é comum em notas fiscais). Fotografe a nota para reconhecer os nomes."
        : "Não consegui reconhecer nomes de produtos. Tente uma foto nítida, bem iluminada e sem inclinação.",
      true,
    );
  }
}

function renderItensCompra() {
  const linhas = $("#linhasCompra");
  linhas.replaceChildren();
  if (!itensCompraReconhecidos.length) {
    $("#btnConfirmarCompra").disabled = true;
    return;
  }

  for (const [indice, item] of itensCompraReconhecidos.entries()) {
    const nome = h("input", {
      type: "text",
      class: "field purchase-name",
      value: item.nome,
      required: true,
      "aria-label": `Nome do item ${indice + 1}`,
      oninput: () => validarItensCompra(),
    });
    const quantidade = h("input", {
      type: "number",
      class: "field",
      min: "0.0001",
      step: "any",
      value: item.quantidade === "" ? "" : item.quantidade,
      placeholder: "Quantidade",
      required: true,
      "aria-label": `Quantidade do item ${indice + 1}`,
      oninput: () => validarItensCompra(),
    });
    const unidade = h(
      "select",
      {
        class: "field",
        "aria-label": `Unidade do item ${indice + 1}`,
        onchange: () => validarItensCompra(),
      },
      ["Kg", "L", "Un"].map((valor) => h("option", { value: valor, text: valor })),
    );
    unidade.value = ["Kg", "L", "Un"].includes(item.unidade) ? item.unidade : "Un";
    const conferido = h("input", {
      type: "checkbox",
      required: true,
      "aria-label": `Confirmo a conferência do item ${indice + 1}`,
      onchange: () => validarItensCompra(),
    });
    const linha = h(
      "div",
      { class: "purchase-row" },
      nome,
      quantidade,
      unidade,
      h("button", {
        type: "button",
        class: "btn-remove",
        text: "×",
        "aria-label": `Remover ${item.nome} da nota`,
        onclick: () => {
          itensCompraReconhecidos.splice(indice, 1);
          renderItensCompra();
          validarItensCompra();
        },
      }),
      h(
        "label",
        { class: "purchase-checked" },
        conferido,
        document.createTextNode("Conferi nome, quantidade e unidade"),
      ),
    );
    linhas.append(linha);
  }
  validarItensCompra();
}

function validarItensCompra() {
  const linhas = [...$("#linhasCompra").querySelectorAll(".purchase-row")];
  $("#btnConfirmarCompra").disabled =
    linhas.length === 0 ||
    linhas.some((linha) => {
      const [nome, quantidade, unidade] = linha.querySelectorAll("input:not([type=checkbox]), select");
      const conferido = linha.querySelector('input[type="checkbox"]');
      return (
        !nome.value.trim() ||
        !Number.isFinite(Number(quantidade.value)) ||
        Number(quantidade.value) <= 0 ||
        !["Kg", "L", "Un"].includes(unidade.value) ||
        !conferido.checked
      );
    });
}

function confirmarEntradaCompra() {
  const linhas = [...$("#linhasCompra").querySelectorAll(".purchase-row")];
  validarItensCompra();
  if ($("#btnConfirmarCompra").disabled) {
    avisar("Revise e marque a conferência de cada item antes de continuar.", "erro");
    return;
  }
  const itens = linhas.map((linha) => {
    const [campoNome, campoQuantidade, campoUnidade] = linha.querySelectorAll(
      "input:not([type=checkbox]), select",
    );
    return {
      nome: normalizar(campoNome.value),
      quantidade: lerNumero(campoQuantidade.value),
      unidade: campoUnidade.value,
    };
  });
  for (const item of itens) {
    const estoque = state.estoque.find((existente) => existente.name === item.nome);
    if (!estoque || estoque.unit === item.unidade) continue;
    const convertido = converterParaEstoque(item.quantidade, item.unidade, estoque.unit);
    if (convertido === null) {
      avisar(
        `${item.nome}: unidade da nota (${item.unidade}) incompatível com o estoque (${estoque.unit}).`,
        "erro",
      );
      return;
    }
    item.quantidade = convertido;
    item.unidade = estoque.unit;
  }
  const duplicados = new Set();
  for (const item of itens) {
    const chave = `${item.nome}|${item.unidade}`;
    if (duplicados.has(chave)) continue;
    const repetidos = itens.filter((outro) => outro.nome === item.nome);
    if (repetidos.some((outro) => outro.unidade !== item.unidade)) {
      avisar(`${item.nome} aparece com unidades diferentes. Corrija antes de confirmar.`, "erro");
      return;
    }
    duplicados.add(chave);
  }
  const resumo = itens
    .map((item) => `${item.nome}: ${formatarQtd(item.quantidade, item.unidade)} ${item.unidade}`)
    .join("\n");
  if (!confirm(`Confira os itens que serão somados ao estoque:\n\n${resumo}\n\nDeseja continuar?`)) {
    return;
  }
  if (!confirm("Última conferência: os saldos do estoque serão atualizados agora. Confirmar a entrada da compra?")) {
    return;
  }

  for (const item of itens) {
    let estoque = state.estoque.find((existente) => existente.name === item.nome);
    if (estoque && estoque.unit !== item.unidade) {
      const convertido = converterParaEstoque(item.quantidade, item.unidade, estoque.unit);
      if (convertido === null) {
        avisar(`${item.nome}: unidade da nota (${item.unidade}) incompatível com o estoque (${estoque.unit}).`, "erro");
        return;
      }
      item.quantidade = convertido;
    }
    if (!estoque) {
      estoque = {
        id: state.proximoIdEstoque++,
        name: item.nome,
        quantity: 0,
        unit: item.unidade,
      };
      state.estoque.push(estoque);
    }
    estoque.quantity = +(Number(estoque.quantity) + item.quantidade).toFixed(4);
    registrar(
      "Entrada no estoque",
      item.nome,
      item.quantidade,
      estoque.unit,
      "Compra conferida pela nota fiscal",
    );
  }

  salvarEstoque();
  renderEstoque();
  $("#dialogNotaCompra").close();
  fecharCameraNota();
  itensCompraReconhecidos = [];
  avisar(`${itens.length} item(ns) de compra adicionado(s) ao estoque.`);
}

function atualizarStatusCamera(mensagem, erro = false) {
  const status = $("#cameraStatus");
  status.textContent = mensagem;
  status.classList.toggle("is-error", erro);
}

function fecharCameraNota() {
  clearTimeout(barcodeScanTimeout);
  barcodeScanTimeout = null;
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  const video = $("#cameraNota");
  video.pause();
  video.srcObject = null;
  video.classList.remove("is-active");
}

async function iniciarCameraNota() {
  if (!navigator.mediaDevices?.getUserMedia) {
    atualizarStatusCamera(
      "Este navegador ou endereço não permite abrir a câmera. Use “Selecionar ou fotografar nota” ou abra em HTTPS/localhost.",
      true,
    );
    return;
  }
  try {
    fecharCameraNota();
    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
    const video = $("#cameraNota");
    video.srcObject = cameraStream;
    video.classList.add("is-active");
    await video.play();
    if (!("BarcodeDetector" in window)) {
      atualizarStatusCamera(
        "Câmera aberta. A leitura automática do QR não é compatível com este navegador; fotografe a nota ou selecione uma imagem.",
        true,
      );
      return;
    }
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    atualizarStatusCamera("Aponte a câmera para o QR Code da nota fiscal.");
    agendarLeituraQrAoVivo(detector);
  } catch (error) {
    atualizarStatusCamera(`Não foi possível abrir a câmera: ${error.message}`, true);
  }
}

function agendarLeituraQrAoVivo(detector) {
  clearTimeout(barcodeScanTimeout);
  barcodeScanTimeout = setTimeout(async () => {
    const video = $("#cameraNota");
    if (!cameraStream || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      agendarLeituraQrAoVivo(detector);
      return;
    }
    try {
      const codigos = await detector.detect(video);
      if (codigos.length) {
        const conteudo = codigos[0].rawValue;
        const itens = extrairItensQrCompra(conteudo);
        if (itens.length) {
          definirItensCompra(itens, "do QR Code");
          return;
        }
        atualizarStatusCamera(
          "QR Code lido, mas sem lista de itens (comum em NFC-e). Fotografe a nota para reconhecer os nomes.",
        );
      }
    } catch (error) {
      atualizarStatusCamera(`Falha ao ler o QR Code: ${error.message}`, true);
      return;
    }
    agendarLeituraQrAoVivo(detector);
  }, 450);
}

async function carregarLeitorOcr() {
  if (window.Tesseract) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.onload = resolve;
    script.onerror = () =>
      reject(new Error("Não foi possível carregar o leitor de texto. Verifique a internet."));
    document.head.append(script);
  });
  if (!window.Tesseract?.createWorker) {
    throw new Error("O leitor de texto carregou sem a função esperada.");
  }
}

async function lerItensDaImagem(imagem) {
  atualizarStatusCamera("Reconhecendo os nomes da nota no próprio navegador...");
  try {
    await carregarLeitorOcr();
    if (!tesseractWorker) {
      tesseractWorker = await window.Tesseract.createWorker("por");
    }
    const resultado = await tesseractWorker.recognize(imagem);
    const nomes = nomesDaNotaPorOcr(resultado.data.text);
    definirItensCompra(nomes, "na foto");
  } catch (error) {
    atualizarStatusCamera(`Não foi possível ler a foto: ${error.message}`, true);
  }
}

async function capturarFotoNota() {
  const video = $("#cameraNota");
  if (!cameraStream || video.videoWidth === 0) {
    atualizarStatusCamera("Abra a câmera ou selecione uma foto da nota primeiro.", true);
    return;
  }
  const canvas = $("#canvasNota");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  canvas.getContext("2d").drawImage(video, 0, 0);
  const foto = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  );
  if (!foto) {
    atualizarStatusCamera("Não foi possível capturar a foto. Tente novamente.", true);
    return;
  }
  await lerItensDaImagem(foto);
}

async function processarArquivoNota(arquivo, tentarQr = true) {
  if (!arquivo) return;
  if (tentarQr && "BarcodeDetector" in window && window.createImageBitmap) {
    try {
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const imagem = await createImageBitmap(arquivo);
      const codigos = await detector.detect(imagem);
      imagem.close();
      if (codigos.length) {
        const itens = extrairItensQrCompra(codigos[0].rawValue);
        if (itens.length) {
          definirItensCompra(itens, "do QR Code");
          return;
        }
      }
    } catch (error) {
      atualizarStatusCamera(`Não foi possível ler o QR da imagem: ${error.message}`, true);
    }
  }
  await lerItensDaImagem(arquivo);
}

function excluirIngrediente(id) {
  const item = state.estoque.find((i) => i.id === id);
  if (
    !item ||
    !confirm(
      `Excluir ${item.name} do estoque? Esta ação não pode ser desfeita.`,
    )
  )
    return;
  state.estoque = state.estoque.filter((i) => i.id !== id);
  salvarEstoque();
  registrar(
    "Exclusão de ingrediente",
    item.name,
    item.quantity,
    item.unit,
    "Saldo no momento da exclusão",
  );
  renderEstoque();
  avisar(`${item.name} removido do estoque.`);
}

// Garante que todo ingrediente de uma receita exista no estoque (criado com quantidade 0)
function sincronizarIngredientes(receita) {
  let criados = 0;
  for (const [nome, { unit }] of Object.entries(receita)) {
    const nomeEstoque = normalizar(nome);
    if (state.estoque.some((item) => item.name === nomeEstoque)) continue;
    state.estoque.push({
      id: state.proximoIdEstoque++,
      name: nomeEstoque,
      quantity: 0,
      unit: MAPA_UNIDADE_ESTOQUE[String(unit).toLowerCase()] || "Un",
    });
    registrar(
      "Cadastro de ingrediente",
      nomeEstoque,
      0,
      MAPA_UNIDADE_ESTOQUE[String(unit).toLowerCase()] || "Un",
      "Criado a partir de uma receita",
    );
    criados++;
  }
  if (criados > 0) salvarEstoque();
  return criados;
}

/* =====================================================
       5. PAINEL PRODUTOS
       ===================================================== */
function idsProdutosOrdenados() {
  return Object.keys(state.nomes).sort((a, b) => Number(a) - Number(b));
}

function renderProdutos() {
  const filtro = normalizar($("#pesquisaPainel").value);
  const todosIds = idsProdutosOrdenados();
  const ids = todosIds.filter((id) =>
    normalizar(state.nomes[id]).includes(filtro),
  );
  $("#listaProdutos").replaceChildren(...ids.map(linhaProduto));
  $("#produtosVazio").hidden = todosIds.length > 0;
  $("#produtosSemResultados").hidden =
    todosIds.length === 0 || ids.length > 0;
}

function linhaProduto(id) {
  const nome = state.nomes[id];
  const receita = state.receitas[id] || {};
  const entrada = h("input", {
    type: "number",
    class: "field",
    min: "0",
    step: "1",
    value: "0",
    "aria-label": `Quantidade de ${nome}`,
    onkeydown: (e) => {
      if (e.key === "Enter") adicionarAutorizacao(id, entrada);
    },
  });

  const itensReceita = Object.entries(receita).map(
    ([ing, { quantity, unit }]) =>
      h("li", { text: `${ing}: ${quantity} ${unit}` }),
  );

  return h(
    "li",
    { class: "product-row" },
    h("span", { class: "row-name", text: nome }),
    entrada,
    h("button", {
      type: "button",
      class: "btn-primary",
      text: "Adicionar",
      onclick: () => adicionarAutorizacao(id, entrada),
    }),
    h(
      "button",
      {
        type: "button",
        class: "btn-edit",
        "aria-label": `Editar produto ${nome}`,
        title: "Editar produto",
        onclick: () => abrirDialogProduto(id),
      },
      criarIcone("edit"),
    ),
    h("button", {
      type: "button",
      class: "btn-remove",
      text: "×",
      "aria-label": `Excluir produto ${nome}`,
      onclick: () => excluirProduto(id),
    }),
    itensReceita.length
      ? h(
          "details",
          { class: "recipe" },
          h("summary", { text: "Ver receita por unidade" }),
          h("ul", {}, itensReceita),
        )
      : null,
  );
}

function excluirProduto(id) {
  const nome = state.nomes[id];
  if (!confirm(`Excluir o produto ${nome} do painel?`)) return;
  delete state.nomes[id];
  delete state.receitas[id];
  delete state.autorizacao[id];
  salvarProdutos();
  registrar("Exclusão de produto", nome);
  renderProdutos();
  renderAutorizacao();
  avisar(`${nome} excluído.`);
}

/* ---------- Autorização ---------- */
function adicionarAutorizacao(id, entrada) {
  const qtd = parseInt(entrada.value, 10);
  if (isNaN(qtd) || qtd <= 0) {
    avisar(`Informe uma quantidade válida para ${state.nomes[id]}.`, "erro");
    entrada.focus();
    return;
  }
  state.autorizacao[id] = qtd;
  entrada.value = 0;
  renderAutorizacao();
  avisar(`${qtd}× ${state.nomes[id]} na lista de autorização.`);
}

function renderAutorizacao() {
  const ids = Object.keys(state.autorizacao);
  $("#listaAutorizacao").replaceChildren(
    ...ids.map((id) =>
      h(
        "li",
        {},
        h("span", {
          text: `${state.nomes[id]}: ${state.autorizacao[id]} unidade(s)`,
        }),
        h("button", {
          type: "button",
          class: "btn-remove",
          text: "×",
          "aria-label": `Remover ${state.nomes[id]} da autorização`,
          onclick: () => {
            delete state.autorizacao[id];
            renderAutorizacao();
          },
        }),
      ),
    ),
  );
  $("#autorizacaoVazia").hidden = ids.length > 0;
  $("#btnFinalizar").disabled = ids.length === 0;
}

function renderDashboard() {
  const grupos = new Map();
  for (const movimento of state.historico) {
    const tipo =
      movimento.tipo === "Produção autorizada"
        ? "produto"
        : movimento.tipo === "Saída do estoque"
          ? "ingrediente"
          : null;
    const quantidade = Number(movimento.quantidade);
    if (!tipo || !Number.isFinite(quantidade) || quantidade <= 0) continue;

    const unidade =
      movimento.unidade || (tipo === "produto" ? "un" : "unidade(s)");
    const chave = `${tipo}|${normalizar(movimento.item)}|${unidade}`;
    const grupo = grupos.get(chave) || {
      tipo,
      nome: movimento.item,
      unidade,
      quantidade: 0,
    };
    grupo.quantidade += quantidade;
    grupos.set(chave, grupo);
  }

  const itens = [...grupos.values()];
  const filtroTipo = $("#dashboardTipo").value;
  const filtroOrdem = $("#dashboardOrdem").value;
  const itensFiltrados = itens.filter(
    (item) => filtroTipo === "geral" || item.tipo === filtroTipo.slice(0, -1),
  );
  itensFiltrados.sort((a, b) => {
    if (filtroOrdem === "mais" && a.quantidade !== b.quantidade) {
      return b.quantidade - a.quantidade;
    }
    if (filtroOrdem === "menos" && a.quantidade !== b.quantidade) {
      return a.quantidade - b.quantidade;
    }
    return a.nome.localeCompare(b.nome, "pt-BR");
  });

  const produzidos = itens
    .filter((item) => item.tipo === "produto")
    .reduce((total, item) => total + item.quantidade, 0);
  const consumidosPorUnidade = new Map();
  for (const item of itens.filter((movimento) => movimento.tipo === "ingrediente")) {
    const unidade = item.unidade || "unidade(s)";
    consumidosPorUnidade.set(
      unidade,
      (consumidosPorUnidade.get(unidade) || 0) + item.quantidade,
    );
  }

  $("#totalProduzido").textContent =
    `${formatarQtd(produzidos, "Un")} unidade(s)`;
  $("#totalConsumido").textContent = consumidosPorUnidade.size
    ? [...consumidosPorUnidade]
        .map(([unidade, quantidade]) => `${formatarQtd(quantidade, unidade)} ${unidade}`)
        .join(" · ")
    : "Nenhum consumo registrado";
  $("#dashboardStorageNotice").textContent = modoPrevia
    ? "Prévia sem autenticação: o estoque e o histórico ficam salvos apenas neste navegador."
    : "O Supabase autentica o acesso; o estoque e o histórico ficam salvos neste navegador.";

  $("#listaDashboard").replaceChildren(
    ...itensFiltrados.map((item) =>
      h(
        "li",
        { class: "dashboard-row" },
        h("span", { class: "dashboard-item-name", text: item.nome }),
        h("span", {
          class: "dashboard-item-type",
          text: item.tipo === "produto" ? "Produto produzido" : "Ingrediente consumido",
        }),
        h("strong", {
          class: "dashboard-item-quantity",
          text: `${formatarQtd(item.quantidade, item.unidade)} ${item.unidade}`,
        }),
      ),
    ),
  );
  $("#dashboardVazio").hidden = itensFiltrados.length > 0;
}

// Mostra o diálogo de resumo: quando a autorização é finalizada (ingredientes)
// ou quando ela é barrada (impedimentos, com o motivo).
function mostrarResumoAutorizacao({
  titulo,
  texto,
  ingredientes = [],
  impedimentos = [],
}) {
  $("#dialogResumoTitulo").textContent = titulo;
  $("#resumoTexto").textContent = texto;
  $("#resumoIngredientes").replaceChildren(
    ...ingredientes.map((linha) => h("li", { text: linha })),
  );
  $("#resumoAvisosLista").replaceChildren(
    ...impedimentos.map((linha) => h("li", { text: linha })),
  );
  $("#resumoAvisos").hidden = impedimentos.length === 0;
  $("#dialogResumo").showModal();
}

function finalizarAutorizacao() {
  const ids = Object.keys(state.autorizacao);
  if (ids.length === 0) return;

  // 1. Calcula tudo ANTES de mexer no estoque:
  //    - totais: o que a produção usa, na unidade de cada receita (para o resumo)
  //    - consumo: o que sai de cada ingrediente, já na unidade do estoque.
  //      Receitas em g e em kg do mesmo ingrediente são somadas antes de
  //      comparar com o saldo (igual ao banco).
  const totais = new Map();
  const consumo = new Map();
  const impedimentos = new Set();

  for (const id of ids) {
    const receita = state.receitas[id] || {};
    for (const [ing, { quantity, unit }] of Object.entries(receita)) {
      const nome = normalizar(ing);
      const necessario = quantity * state.autorizacao[id];

      const chave = `${nome}|${unit}`;
      const atual = totais.get(chave) || { nome, unidade: unit, total: 0 };
      atual.total += necessario;
      totais.set(chave, atual);

      const item = state.estoque.find((i) => i.name === nome);
      if (!item) {
        impedimentos.add(
          `${nome} não está no estoque. Cadastre o ingrediente antes de autorizar.`,
        );
        continue;
      }
      const debito = converterParaEstoque(necessario, unit, item.unit);
      if (debito === null) {
        impedimentos.add(
          `${nome}: a receita usa ${unit}, mas o estoque está em ${item.unit}. Ajuste a unidade.`,
        );
        continue;
      }
      const acumulado = consumo.get(nome) || { item, debito: 0 };
      acumulado.debito += debito;
      consumo.set(nome, acumulado);
    }
  }

  // 2. Confere o saldo de cada ingrediente
  for (const [nome, { item, debito }] of consumo) {
    const necessario = +debito.toFixed(4);
    const disponivel = Number(item.quantity);
    if (disponivel < necessario) {
      const falta = +(necessario - disponivel).toFixed(4);
      impedimentos.add(
        `Estoque insuficiente de ${nome}: disponível ${formatarQtd(disponivel, item.unit)} ${item.unit}, ` +
          `necessário ${formatarQtd(necessario, item.unit)} ${item.unit} ` +
          `(faltam ${formatarQtd(falta, item.unit)} ${item.unit}).`,
      );
    }
  }

  // 3. Se algo impede a produção, NADA é debitado e NADA vai para o histórico
  //    (o banco faz o mesmo: devolve ESTOQUE_INSUFICIENTE e não altera nada).
  //    A lista de autorização fica como está, para corrigir e tentar de novo.
  if (impedimentos.size > 0) {
    mostrarResumoAutorizacao({
      titulo: "Autorização não finalizada",
      texto:
        "Nada foi debitado do estoque. Reponha os ingredientes ou reduza as quantidades e tente de novo.",
      impedimentos: [...impedimentos],
    });
    return;
  }

  // 4. Tudo certo: anota a produção no histórico e debita o estoque
  const descricao = ids
    .map((id) => `${state.autorizacao[id]}x ${state.nomes[id]}`)
    .join(", ");
  for (const id of ids) {
    registrar(
      "Produção autorizada",
      state.nomes[id],
      state.autorizacao[id],
      "un",
    );
  }
  for (const [nome, { item, debito }] of consumo) {
    const saida = +debito.toFixed(4);
    item.quantity = +(Number(item.quantity) - saida).toFixed(4);
    registrar(
      "Saída do estoque",
      nome,
      saida,
      item.unit,
      `Autorização: ${descricao}`,
    );
  }
  salvarEstoque();

  // 5. Mostra o resumo
  mostrarResumoAutorizacao({
    titulo: "Autorização finalizada",
    texto: `${ids.length} produto(s) autorizado(s). Ingredientes usados:`,
    ingredientes: [...totais.values()].map(
      (t) =>
        `${t.nome}: ${Number(t.total.toFixed(2)).toLocaleString("pt-BR")} ${t.unidade}`,
    ),
  });

  state.autorizacao = {};
  renderAutorizacao();
  renderEstoque();
}

/* ---------- Diálogo de novo produto ---------- */
const NOVO_INGREDIENTE = "__novo__";

// Unidade sugerida na receita conforme a unidade do estoque (Kg → g, L → ml, Un → un)
const UNIDADE_RECEITA_PADRAO = { Kg: "g", L: "ml", Un: "un" };

// "inicial" é opcional: { nome, quantity, unit } para preencher a linha ao editar
function linhaReceita(inicial = null) {
  const temEstoque = state.estoque.length > 0;
  const noEstoque =
    inicial && state.estoque.some((i) => i.name === normalizar(inicial.nome));

  // Campo de texto: só aparece quando a pessoa escolhe "+ Novo ingrediente"
  const campoNovo = h("input", {
    type: "text",
    class: "field ing-name",
    list: "sugestoesIngredientes",
    placeholder: "Nome do novo ingrediente",
    "aria-label": "Nome do novo ingrediente",
    hidden: temEstoque && (!inicial || noEstoque),
    value: inicial && !noEstoque ? inicial.nome : null,
  });

  const unidade = h(
    "select",
    { class: "field ing-unit", "aria-label": "Unidade" },
    ["g", "kg", "ml", "L", "un"].map((u) => h("option", { value: u, text: u })),
  );

  // Lista com os ingredientes que já estão no estoque
  const escolha = h(
    "select",
    {
      class: "field ing-choice",
      "aria-label": "Ingrediente",
      onchange: () => {
        const novo = escolha.value === NOVO_INGREDIENTE;
        campoNovo.hidden = !novo;
        if (novo) {
          campoNovo.focus();
          return;
        }
        const item = state.estoque.find((i) => i.name === escolha.value);
        if (item) unidade.value = UNIDADE_RECEITA_PADRAO[item.unit] || "un";
      },
    },
    h("option", {
      value: "",
      text: temEstoque ? "Escolha um ingrediente…" : "Estoque vazio",
    }),
    state.estoque.map((item) =>
      h("option", {
        value: item.name,
        text: `${item.name} (${formatarQtd(item.quantity, item.unit)} ${item.unit})`,
      }),
    ),
    h("option", { value: NOVO_INGREDIENTE, text: "+ Novo ingrediente" }),
  );
  if (!temEstoque) escolha.value = NOVO_INGREDIENTE;

  // Ao editar: ingrediente do estoque fica selecionado; se não estiver no estoque, vai no campo de texto
  if (inicial) {
    escolha.value = noEstoque ? normalizar(inicial.nome) : NOVO_INGREDIENTE;
    unidade.value = inicial.unit;
  }

  const linha = h(
    "div",
    { class: "recipe-row" },
    escolha,
    h("input", {
      type: "number",
      class: "field ing-qty",
      step: "any",
      min: "0",
      value: inicial ? String(inicial.quantity) : "1",
      "aria-label": "Quantidade por unidade",
    }),
    unidade,
    h("button", {
      type: "button",
      class: "btn-remove",
      text: "×",
      "aria-label": "Remover ingrediente",
      onclick: () => linha.remove(),
    }),
    campoNovo,
  );
  return linha;
}

let produtoEmEdicao = null; // id do produto sendo editado, ou null quando é um cadastro novo

function abrirDialogProduto(id = null) {
  produtoEmEdicao = id;
  $("#formProduto").reset();
  $("#dialogProdutoTitulo").textContent = id
    ? "Editar produto"
    : "Cadastrar novo produto";
  $("#btnSalvarProduto").textContent = id
    ? "Salvar alterações"
    : "Salvar produto";

  if (id) {
    $("#novoProdutoNome").value = state.nomes[id];
    const itens = Object.entries(state.receitas[id] || {});
    $("#linhasReceita").replaceChildren(
      ...(itens.length
        ? itens.map(([nome, r]) =>
            linhaReceita({ nome, quantity: r.quantity, unit: r.unit }),
          )
        : [linhaReceita()]),
    );
  } else {
    $("#linhasReceita").replaceChildren(linhaReceita());
  }
  atualizarSugestoes();
  $("#dialogProduto").showModal();
  $("#novoProdutoNome").focus();
}

function salvarProduto(evento) {
  evento.preventDefault();
  const nome = normalizar($("#novoProdutoNome").value);

  if (!nome) {
    avisar("O nome do produto não pode ficar vazio.", "erro");
    return;
  }
  const nomeRepetido = Object.entries(state.nomes).some(
    ([outroId, outroNome]) => outroNome === nome && outroId !== produtoEmEdicao,
  );
  if (nomeRepetido) {
    avisar("Já existe um produto com esse nome.", "erro");
    return;
  }

  const receita = {};
  for (const linha of $("#linhasReceita").children) {
    const escolhido = linha.querySelector(".ing-choice").value;
    const ing = normalizar(
      escolhido === NOVO_INGREDIENTE
        ? linha.querySelector(".ing-name").value
        : escolhido,
    );
    const qtd = lerNumero(linha.querySelector(".ing-qty").value);
    if (!ing || isNaN(qtd) || qtd <= 0) continue;
    if (receita[ing]) {
      avisar(`${ing} aparece duas vezes na receita.`, "erro");
      return;
    }
    receita[ing] = {
      quantity: qtd,
      unit: linha.querySelector(".ing-unit").value,
    };
  }

  if (Object.keys(receita).length === 0) {
    avisar(
      "Cadastre pelo menos um ingrediente com quantia maior que zero.",
      "erro",
    );
    return;
  }

  const editando = produtoEmEdicao !== null;
  const id = editando ? produtoEmEdicao : String(state.proximoIdProduto++);
  const nomeAnterior = state.nomes[id];
  state.nomes[id] = nome;
  state.receitas[id] = receita;
  salvarProdutos();

  const textoReceita =
    "Receita: " +
    Object.entries(receita)
      .map(([ing, r]) => `${ing} ${r.quantity} ${r.unit}`)
      .join(", ");
  if (editando) {
    const renomeado = nomeAnterior !== nome ? ` (antes: ${nomeAnterior})` : "";
    registrar("Edição de produto", nome, null, "", textoReceita + renomeado);
  } else {
    registrar("Cadastro de produto", nome, null, "", textoReceita);
  }
  const criados = sincronizarIngredientes(receita);

  $("#dialogProduto").close();
  produtoEmEdicao = null;
  renderProdutos();
  renderAutorizacao(); // se o nome mudou, a lista de autorização mostra o nome novo
  renderEstoque();

  const acao = editando ? "atualizado" : "cadastrado";
  avisar(
    criados
      ? `${nome} ${acao}. ${criados} ingrediente(s) novo(s) criado(s) no estoque.`
      : `${nome} ${acao}.`,
  );
}

/* =====================================================
       6. RELATÓRIO EM PDF
       ===================================================== */
function gerarRelatorioPDF() {
  if (!window.jspdf) {
    avisar(
      "O gerador de PDF não carregou. Verifique a internet e recarregue a página.",
      "erro",
    );
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const agora = new Date();
  const corMarca = [237, 143, 54];

  // Cabeçalho
  doc.setFontSize(16);
  doc.text("Relatório de movimentação - Luana Salgadinhos", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Gerado em ${agora.toLocaleString("pt-BR")}`, 14, 25);
  doc.setTextColor(0);

  // Parte 1: como o estoque está agora
  doc.setFontSize(13);
  doc.text("Estoque atual", 14, 36);
  doc.autoTable({
    startY: 40,
    head: [["Ingrediente", "Quantidade", "Unidade"]],
    body: state.estoque.length
      ? state.estoque.map((i) => [
          i.name,
          formatarQtd(i.quantity, i.unit),
          i.unit,
        ])
      : [[{ content: "Nenhum ingrediente no estoque.", colSpan: 3 }]],
    headStyles: { fillColor: corMarca },
    columnStyles: { 1: { halign: "right" } },
  });

  // Parte 2: todas as movimentações, da mais nova para a mais antiga
  let y = doc.lastAutoTable.finalY + 12;
  doc.setFontSize(13);
  doc.text("Movimentações", 14, y);
  doc.autoTable({
    startY: y + 4,
    head: [["Data", "Tipo", "Item", "Quantidade", "Detalhe"]],
    body: state.historico.length
      ? [...state.historico]
          .reverse()
          .map((m) => [
            new Date(m.data).toLocaleString("pt-BR"),
            m.tipo,
            m.item,
            m.quantidade === null
              ? ""
              : `${formatarQtd(m.quantidade, m.unidade)} ${m.unidade}`,
            m.detalhe,
          ])
      : [[{ content: "Nenhuma movimentação registrada ainda.", colSpan: 5 }]],
    headStyles: { fillColor: corMarca },
    styles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 30 }, 3: { halign: "right" } },
  });

  // Número da página no rodapé
  const totalPaginas = doc.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(`Página ${i} de ${totalPaginas}`, 196, 290, { align: "right" });
  }

  const dataArquivo = agora
    .toLocaleDateString("pt-BR")
    .split("/")
    .reverse()
    .join("-"); // ex.: 2026-09-22
  doc.save(`relatorio-movimentacao-${dataArquivo}.pdf`);
  avisar("Relatório baixado.");
}

/* =====================================================
       7. NAVEGAÇÃO ENTRE PAINÉIS (#estoque / #produtos)
       ===================================================== */
const PAINEIS = {
  dashboard: {
    titulo: "DASHBOARD",
    iconeTrocar: "warehouse",
    rotuloTrocar: "Ir para produtos",
    rotuloNovo: "Novo produto",
    rotuloPesquisa: "Pesquisar produto",
    placeholderPesquisa: "Pesquise um produto",
  },
  estoque: {
    titulo: "ESTOQUE",
    iconeTrocar: "storefront",
    rotuloTrocar: "Ir para produtos",
    rotuloNovo: "Novo ingrediente",
    rotuloPesquisa: "Pesquisar ingrediente",
    placeholderPesquisa: "Pesquise um ingrediente",
  },
  produtos: {
    titulo: "PRODUTOS",
    iconeTrocar: "warehouse",
    rotuloTrocar: "Ir para o estoque",
    rotuloNovo: "Novo produto",
    rotuloPesquisa: "Pesquisar produto",
    placeholderPesquisa: "Pesquise um produto",
  },
};

let painelAtual = "produtos";

function mostrarPainel(nome) {
  painelAtual = PAINEIS[nome] ? nome : "produtos";
  const cfg = PAINEIS[painelAtual];

  $("#painel-estoque").hidden = painelAtual !== "estoque";
  $("#painel-produtos").hidden = painelAtual !== "produtos";
  $("#painel-dashboard").hidden = painelAtual !== "dashboard";
  $(".panel-tools").hidden = painelAtual === "dashboard";
  $("#btnEscanearNota").hidden = painelAtual !== "estoque";
  $("#tituloPainel").textContent = cfg.titulo;
  const iconeTrocar = criarIcone(cfg.iconeTrocar);
  iconeTrocar.id = "iconeTrocar";
  $("#iconeTrocar").replaceWith(iconeTrocar);

  const btnTrocar = $("#btnTrocarPainel");
  btnTrocar.setAttribute("aria-label", cfg.rotuloTrocar);
  btnTrocar.title = cfg.rotuloTrocar;

  const btnNovo = $("#btnNovo");
  btnNovo.setAttribute("aria-label", cfg.rotuloNovo);
  btnNovo.title = cfg.rotuloNovo;

  const pesquisa = $("#pesquisaPainel");
  pesquisa.placeholder = cfg.placeholderPesquisa;
  $("#rotuloPesquisa").textContent = cfg.rotuloPesquisa;

  const tituloDocumento =
    cfg.titulo === "ESTOQUE"
      ? "Estoque"
      : cfg.titulo === "DASHBOARD"
        ? "Dashboard"
        : "Produtos";
  document.title = `${tituloDocumento} · Luana Salgadinhos`;
}

function painelDaUrl() {
  return location.hash.replace("#", "") || "produtos";
}

/* =====================================================
       8. EVENTOS E INICIALIZAÇÃO
       ===================================================== */
$("#btnTrocarPainel").addEventListener("click", () => {
  location.hash =
    painelAtual === "dashboard"
      ? "produtos"
      : painelAtual === "estoque"
        ? "produtos"
        : "estoque";
});

$("#btnDashboard").addEventListener("click", () => {
  location.hash = "dashboard";
});

$("#btnEscanearNota").addEventListener("click", () => {
  itensCompraReconhecidos = [];
  renderItensCompra();
  $("#arquivoNota").value = "";
  atualizarStatusCamera(
    "Aponte a câmera para o QR Code. Se não houver itens no QR, fotografe a nota.",
  );
  $("#dialogNotaCompra").showModal();
  iniciarCameraNota();
});

$("#btnNovo").addEventListener("click", () => {
  if (painelAtual === "produtos") {
    abrirDialogProduto();
    return;
  }
  const form = $("#formIngrediente");
  form.hidden = !form.hidden;
  if (!form.hidden) $("#novoIngredienteNome").focus();
});

window.addEventListener("hashchange", () => mostrarPainel(painelDaUrl()));

$("#formIngrediente").addEventListener("submit", cadastrarIngrediente);
$("#formProduto").addEventListener("submit", salvarProduto);
$("#pesquisaPainel").addEventListener("input", () => {
  if (painelAtual === "estoque") renderEstoque();
  else renderProdutos();
});
$("#dashboardTipo").addEventListener("change", renderDashboard);
$("#dashboardOrdem").addEventListener("change", renderDashboard);
$("#btnAddIngrediente").addEventListener("click", () => {
  const linha = linhaReceita();
  $("#linhasReceita").append(linha);
  linha.querySelector(".ing-choice").focus();
});
$("#btnCancelarProduto").addEventListener("click", () =>
  $("#dialogProduto").close(),
);
$("#btnFinalizar").addEventListener("click", finalizarAutorizacao);
$("#btnFecharResumo").addEventListener("click", () =>
  $("#dialogResumo").close(),
);
$("#btnRelatorio").addEventListener("click", gerarRelatorioPDF);
$("#btnIniciarCamera").addEventListener("click", iniciarCameraNota);
$("#btnFotoNota").addEventListener("click", capturarFotoNota);
$("#btnLerQrFoto").addEventListener("click", () => $("#arquivoNota").click());
$("#arquivoNota").addEventListener("change", (evento) =>
  processarArquivoNota(evento.target.files?.[0]),
);
$("#btnConfirmarCompra").addEventListener("click", confirmarEntradaCompra);
$("#btnFecharNota").addEventListener("click", () =>
  $("#dialogNotaCompra").close(),
);
$("#dialogNotaCompra").addEventListener("close", fecharCameraNota);

function mostrarMensagemLogin(mensagem) {
  $("#authMessage").textContent = mensagem;
}

function configurarTelaLogin() {
  document.title = "Acesso · Luana Salgadinhos";
  const config = window.SUPABASE_CONFIG || {};
  const previewHabilitada = config.allowGuestPreview === true;
  $("#btnAcessarPrevia").hidden = !previewHabilitada;
  $("#btnAcessarPrevia").addEventListener("click", abrirPreviaLocal);
  if (config.startInGuestPreview === true && previewHabilitada) {
    abrirPreviaLocal();
    return;
  }
  const url = String(config.url || "").trim();
  const anonKey = String(config.anonKey || "").trim();
  const configurado = /^https?:\/\/.+/.test(url) && anonKey.length > 0;
  $("#loginSubmit").disabled = !configurado;
  if (!configurado) {
    mostrarMensagemLogin(
      previewHabilitada
        ? "O login está desconfigurado. Use a prévia local para acessar as telas neste navegador."
        : "Configure a URL e a chave pública (anon/publishable) do Supabase em supabase-config.js para habilitar o acesso.",
    );
  }
  if (configurado) {
    inicializarSupabase(url, anonKey);
  }

  if (configurado) {
    const loginForm = $("#loginForm");
    loginForm.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const botao = $("#loginSubmit");
      botao.disabled = true;
      mostrarMensagemLogin("Conectando...");
      try {
        const client = await obterClienteSupabase(url, anonKey);
        const { error } = await client.auth.signInWithPassword({
          email: $("#loginEmail").value.trim(),
          password: $("#loginPassword").value,
        });
        if (error) throw error;
        mostrarMensagemLogin("");
      } catch (error) {
        mostrarMensagemLogin(`Não foi possível entrar: ${error.message}`);
      } finally {
        botao.disabled = false;
      }
    });

    const logout = async () => {
      if (modoPrevia) {
        fecharAplicacao();
        return;
      }
      $("#btnSair").disabled = true;
      try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
      } catch (error) {
        avisar(`Não foi possível sair: ${error.message}`, "erro");
      } finally {
        $("#btnSair").disabled = false;
      }
    };
    $("#btnSair").addEventListener("click", logout);
  } else {
    $("#btnSair").addEventListener("click", fecharAplicacao);
  }
}

let supabaseClient = null;
let supabasePromise = null;
let usuarioAtivo = null;
let modoPrevia = false;

function abrirPreviaLocal() {
  modoPrevia = true;
  usuarioAtivo = null;
  state.userId = null;
  state.autorizacao = {};
  carregarEstado();
  $("#authScreen").hidden = true;
  $("#appRoot").hidden = false;
  $("#previewBanner").hidden = false;
  $("#btnSair").title = "Sair da prévia";
  renderEstoque();
  renderProdutos();
  renderAutorizacao();
  renderDashboard();
  mostrarPainel("dashboard");
}

function obterClienteSupabase(url, anonKey) {
  if (supabaseClient) return Promise.resolve(supabaseClient);
  if (window.supabase?.createClient) {
    supabaseClient = window.supabase.createClient(url, anonKey);
    return Promise.resolve(supabaseClient);
  }
  if (supabasePromise) return supabasePromise;
  supabasePromise = new Promise((resolve, reject) => {
    const sdk = document.createElement("script");
    sdk.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    sdk.onload = () => {
      if (!window.supabase?.createClient) {
        supabasePromise = null;
        reject(new Error("A biblioteca do Supabase carregou sem a função esperada."));
        return;
      }
      try {
        supabaseClient = window.supabase.createClient(url, anonKey);
        resolve(supabaseClient);
      } catch (error) {
        supabasePromise = null;
        reject(error);
      }
    };
    sdk.onerror = () => {
      supabasePromise = null;
      reject(new Error("Não foi possível carregar o Supabase. Verifique sua conexão."));
    };
    document.head.append(sdk);
  });
  return supabasePromise;
}

async function inicializarSupabase(url, anonKey) {
  try {
    const client = await obterClienteSupabase(url, anonKey);
    client.auth.onAuthStateChange((_evento, session) => {
      if (session?.user) abrirAplicacao(session.user);
      else fecharAplicacao();
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session?.user) abrirAplicacao(data.session.user);
    else mostrarMensagemLogin("Entre com sua conta Supabase para continuar.");
  } catch (error) {
    mostrarMensagemLogin(`Não foi possível conectar ao Supabase: ${error.message}`);
  }
}

function abrirAplicacao(user) {
  if (usuarioAtivo === user.id && !$("#appRoot").hidden) return;
  modoPrevia = false;
  usuarioAtivo = user.id;
  store.useAccount(user.id);
  state.autorizacao = {};
  carregarEstado();
  $("#authScreen").hidden = true;
  $("#appRoot").hidden = false;
  $("#previewBanner").hidden = true;
  $("#btnSair").title = user.email || "Sair da conta";
  renderEstoque();
  renderProdutos();
  renderAutorizacao();
  renderDashboard();
  mostrarPainel("dashboard");
  if (location.hash !== "#dashboard") {
    history.replaceState(null, "", `${location.pathname}${location.search}#dashboard`);
  }
}

function fecharAplicacao() {
  modoPrevia = false;
  usuarioAtivo = null;
  state.userId = null;
  state.estoque = [];
  state.nomes = {};
  state.receitas = {};
  state.historico = [];
  state.autorizacao = {};
  $("#appRoot").hidden = true;
  $("#authScreen").hidden = false;
  $("#previewBanner").hidden = true;
  $("#loginPassword").value = "";
  document.title = "Acesso · Luana Salgadinhos";
  mostrarMensagemLogin("Sessão encerrada. Entre novamente para continuar.");
}

// Se o estoque mudar em outra aba, recarrega os dados da conta autenticada.
window.addEventListener("storage", (e) => {
  if (!Object.values(KEYS).some((key) => store.storageKey(key) === e.key)) return;
  carregarEstado();
  renderEstoque();
  renderProdutos();
  renderAutorizacao();
  renderDashboard();
});

configurarTelaLogin();
