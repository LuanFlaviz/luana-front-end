# Documentação do projeto Luana Salgadinhos

## Visão geral

Este repositório contém uma aplicação web simples, voltada para o controle de estoque de ingredientes, cadastro de receitas, autorização de produção e acompanhamento de movimentações do estabelecimento. A interface é totalmente front-end, com dados persistidos no navegador por meio do `localStorage` e com opção de autenticação por Supabase para separar dados por usuário.

A aplicação permite:

- cadastrar e editar ingredientes no estoque;
- adicionar quantidades ao estoque manualmente ou via leitura de nota fiscal;
- cadastrar produtos e receitas;
- validar se há estoque suficiente antes de autorizar produção;
- registrar histórico de movimentações;
- gerar relatório em PDF;
- visualizar um dashboard resumindo produção e consumo;
- utilizar modo de prévia local quando o login do Supabase não estiver configurado.

O projeto é composto por cinco arquivos principais, todos presentes na raiz do repositório:

- `index.html`
- `style.css`
- `script.js`
- `supabase-config.js`
- `autorizacao.test.js`

---

## 1. index.html

### Função

O arquivo `index.html` define a estrutura de interface da aplicação. Ele montou a tela inicial de autenticação, a área principal do sistema e os modais/dialógos usados em vários fluxos, como cadastro de produtos, entrada de compra e resumo de autorização.

### Estrutura principal

#### Tela de login

A aplicação começa com uma tela de autenticação chamada `authScreen`:

- campo de e-mail;
- campo de senha;
- botão para entrar;
- botão para acessar a prévia local, caso o projeto tenha sido configurado sem Supabase;
- mensagem de erro ou status do login.

Essa tela é exibida antes do usuário acessar o painel principal.

#### Área principal da aplicação

Após o login ou acesso em prévia, a interface ativa o container `#appRoot`, que reúne:

- barra superior (`topbar`);
- botão para trocar entre painéis;
- botão para gerar relatório PDF;
- botão para abrir dashboard;
- título do painel atual;
- área de pesquisa;
- botão de novo item;
- painel de estoque;
- painel de produtos;
- painel de dashboard.

#### Painéis

A aplicação alterna entre os seguintes painéis:

- `estoque`: lista ingredientes, permite adição e ajuste de saldos;
- `produtos`: lista produtos e suas receitas;
- `dashboard`: mostra resumo de produção e consumo por tipo e quantidade.

#### Diálogos e modais

O HTML também contém elementos de diálogo para:

- cadastro/edição de produtos;
- confirmação de autorização de produção;
- resumo do resultado da autorização;
- leitura de nota de compra;
- processamento de QR Code e imagem de nota fiscal.

Esses modais permitem uma experiência mais organizada sem a necessidade de páginas separadas.

#### Dependências externas

No cabeçalho há carregamento de bibliotecas externas:

- `jspdf` para geração de relatórios em PDF;
- `jspdf-autotable` para a criação de tabelas dentro do PDF;
- `supabase-config.js`, que oferece as configurações de conexão com Supabase.

---

## 2. style.css

### Função

O arquivo `style.css` define toda a identidade visual da aplicação. Ele organiza a aparência da interface, incluindo cores, tipos de botão, listas, campos de formulário, mensagens, ícones e o layout dos painéis.

### Características gerais

#### Tema visual

O projeto usa uma paleta com tons de:

- laranja;
- amarelo;
- marrom;
- branco;
- cinza suave.

A interface tem visual bem acolhedor e foco em um ambiente de produção culinária/industrial.

#### Estrutura do layout

O CSS define:

- corpo da página;
- barra superior fixada no topo;
- cards e painéis de conteúdo;
- listas de itens e filas de formulários;
- apresentação limpa de campos de pesquisa e botões;
- comportamento de elementos escondidos com `[hidden]`.

#### Estilos de componentes importantes

- `.topbar`: barra superior com aplicação de gradiente e elementos bem espaçados;
- `.auth-screen` e `.auth-card`: tela de login com visual centralizado;
- `.btn-primary`, `.btn-secondary`, `.btn-edit`, `.btn-remove`: variações de botões;
- `.field`: campos de formulário padronizados;
- `.panel-tools`: zona de pesquisa e ações no painel;
- `.stock-row`, `.product-row`, `.dashboard-row`: linhas de listas com organização visual;
- `.ui-icon`: ícones SVG com padronização visual;
- `.toast` e `.auth-message`: feedback visual para erros e ações.

#### Acessibilidade

O CSS também inclui foco visível com `:focus-visible`, o que ajuda na navegação por teclado. Há atenção também a elementos com `aria-*`, como labels e mensagens: a aplicação foi pensada para ser usável e resiliente.

---

## 3. script.js

### Função

Este é o coração da aplicação. O arquivo `script.js` concentra toda a lógica do sistema: estado, persistência, regras de estoque, receitas, autorização de produção, leitura de notas, autenticação e dashboard.

Ele é o documento mais importante do projeto, pois conecta interface e regras de negócio.

### 3.1 Armazenamento e estado

O código define um objeto `KEYS` com chaves usadas para salvar dados no `localStorage`:

- estoque;
- próximo id do estoque;
- receitas;
- nomes dos produtos;
- próximo id do produto;
- histórico de movimentações.

Também há um objeto `store`, com métodos para:

- ler dados;
- gravar dados;
- salvar por conta/usuário;
- migrar dados antigos para a chave nova;
- manter compatibilidade entre versões anteriores.

O `state` centraliza os dados em memória:

- `userId`;
- `estoque`;
- `proximoIdEstoque`;
- `nomes`;
- `receitas`;
- `proximoIdProduto`;
- `historico`;
- `autorizacao`.

Essas estruturas permitem que a UI renderize os itens, o histórico e os produtos de forma consistente.

### 3.2 Utilitários

O script inclui diversas funções auxiliares para:

- normalizar textos;
- formatar quantidades e unidades;
- converter valores entre unidades (`g`, `Kg`, `ml`, `L`, `un`);
- criar elementos DOM sem depender de `innerHTML` (para evitar problemas com nomes que contenham `"`, `<` ou `>`);
- gerar avisos visuais (`toast`);
- listar sugestões de ingredientes.

Esses utilitários reduzem a repetição de código e ajudam a manter a interface consistente.

### 3.3 Painel de estoque

A lógica de estoque inclui:

- renderização da lista de ingredientes;
- pesquisa por nome;
- cadastro de novo ingrediente;
- soma de quantidades ao estoque;
- remoção de itens;
- geração de histórico de movimentações.

Funções-chave:

- `renderEstoque()`
- `linhaEstoque(item)`
- `cadastrarIngrediente(evento)`
- `somarEstoque(id, entrada)`
- `excluirIngrediente(id)`

A aplicação também permite tratar a compra de ingredientes pela leitura de nota fiscal. Esse recurso é robusto e faz parte de uma das funcionalidades mais sofisticadas do sistema.

### 3.4 Leitura de nota fiscal / QR / OCR

O projeto inclui mecanismos para reconhecer itens de compra por:

- QR Code;
- imagem da nota fiscal;
- OCR local via Tesseract;
- leitura do XML ou JSON da NF-e.

As funções relevantes incluem:

- `extrairItensQrCompra(conteudo)`
- `nomesDaNotaPorOcr(texto)`
- `definirItensCompra(itens, origem)`
- `processarArquivoNota(arquivo, tentarQr = true)`
- `iniciarCameraNota()`
- `capturarFotoNota()`
- `carregarLeitorOcr()`
- `lerItensDaImagem(imagem)`

Essas funções convertem a compra em itens reconhecidos, ajustam unidades para o estoque e confirmam a entrada do material no sistema.

Isso permite que o operador fotografe a nota ou aponte a câmera para o QR Code e, em seguida, confirme se os itens foram lidos corretamente antes de aumentar o estoque.

### 3.5 Painel de produtos e receitas

O aplicativo permite:

- cadastrar um produto novo;
- editar ou excluir um produto;
- definir uma receita por ingrediente;
- associar quantidade e unidade de cada ingrediente;
- visualizar a receita em detalhes.

Funções importantes:

- `renderProdutos()`
- `linhaProduto(id)`
- `abrirDialogProduto(id = null)`
- `salvarProduto(evento)`
- `excluirProduto(id)`

Essa parte do sistema é fundamental para conectar a produção ao estoque, porque os produtos herdaram as necessidades de ingredientes em suas receitas.

### 3.6 Autorização de produção

A aplicação possui um mecanismo de autorização em que o usuário monta uma lista de produtos a serem produzidos e, antes de confirmar, o sistema verifica se os ingredientes necessários estão disponíveis.

Fluxo principal:

1. o usuário adiciona um produto à lista de autorização;
2. o sistema armazena em `state.autorizacao` a quantidade desejada;
3. ao clicar em finalizar, a aplicação calcula o consumo total por ingrediente;
4. compara com o saldo disponível no estoque;
5. rejeita ou aprova a produção conforme a disponibilidade real.

Funções centrais:

- `adicionarAutorizacao(id, entrada)`
- `renderAutorizacao()`
- `finalizarAutorizacao()`
- `mostrarResumoAutorizacao({ ... })`

A lógica de validação também considera alterações de unidade, por exemplo `g` e `kg`, somando corretamente para identificar se o estoque dá conta do pedido.

Se houver falhas, o sistema exibe uma mensagem detalhada do que falta e bloqueia a autorização.

### 3.7 Relatório em PDF

A função `gerarRelatorioPDF()` utiliza `jsPDF` para gerar um relatório que inclui:

- estoque atual;
- todas as movimentações do histórico;
- data e hora de geração;
- paginação do documento.

Esse recurso é importante para dar visibilidade ao histórico do negócio e facilitar a análise ou exportação documental.

### 3.8 Navegação entre painéis

O script também gerencia a navegação por hash da URL:

- `#estoque`
- `#produtos`
- `#dashboard`

Isso permite alternar visualmente entre as vistas sem recarregar a página. A função `mostrarPainel()` ajusta o título e as ações de cada tela.

### 3.9 Integração com Supabase e autenticação

A aplicação foi construída para funcionar com autenticação por Supabase. O arquivo `supabase-config.js` contém as configurações base, e o script valida se a URL e a chave pública foram preenchidas.

Recursos implementados:

- login por e-mail e senha;
- sessão ativa;
- logout;
- separação de dados por usuário através de `state.userId` e prefixos no `localStorage`;
- fallback para acesso em modo de prévia local.

Funções principais:

- `configurarTelaLogin()`
- `obterClienteSupabase(url, anonKey)`
- `inicializarSupabase(url, anonKey)`
- `abrirAplicacao(user)`
- `fecharAplicacao()`
- `abrirPreviaLocal()`

Esse comportamento permite simultaneamente:

- uso em ambiente real com uso de conta do cliente;
- uso em navegador local sem autenticação, quando a configuração do Supabase não foi feita.

### 3.10 Dashboard

O dashboard consolida as movimentações do histórico e mostra:

- total produzido;
- total consumido;
- itens por tipo;
- classificações por produto ou ingrediente;
- filtro por ordem crescente/decrescente;
- filtro por tipo de item.

A função `renderDashboard()` processa o histórico e agrupa os resultados, transformando movimentações brutas em uma visão resumida e útil para controle.

---

## 4. supabase-config.js

### Função

Este arquivo configura a inicialização da aplicação com Supabase. Ele contém um objeto global chamado `window.SUPABASE_CONFIG` com campos como:

- `url`: URL do projeto Supabase;
- `anonKey`: chave pública/anon do projeto;
- `allowGuestPreview`: habilita ou não o acesso em modo de prévia local;
- `startInGuestPreview`: inicia diretamente em prévia local quando desejado.

### Importância

Esse arquivo é essencial para ativar a autenticação real. Sem preencher `url` e `anonKey`, a aplicação fica em modo de demonstração/local e exibe a tela de prévia.

### Observação

O comentário no arquivo deixa explícito que não se deve usar a chave secreta `service_role` no front-end, o que é uma prática correta de segurança.

---

## 5. autorizacao.test.js

### Função

Este arquivo contém a suíte de testes automatizados para validar a lógica de autorização de produção.

Ele usa `node:test` e `jsdom` para simular o DOM e executar a aplicação em ambiente controlado, sem necessidade de rede.

### O que é validado

Os testes cobrem cenários como:

- autorização concluída com estoque suficiente;
- bloqueio da autorização quando o estoque é insuficiente;
- soma correta de ingredientes em unidades diferentes (`g` e `kg`);
- rejeição quando um ingrediente da receita não existe no estoque;
- rejeição quando a unidade da receita é incompatível com a unidade do estoque;
- reabertura da autorização após reposição do estoque;
- funcionamento do dashboard calculando produção e consumo;
- validação correta do histórico de movimentações.

### Valor do arquivo

Ele funciona como garantia de regressão e documentação comportamental: se qualquer alteração futura quebrar o cálculo de produção ou o histórico, os testes alertam imediatamente.

---

## Resumo da arquitetura

O projeto possui uma arquitetura simples e eficaz para aplicação front-end:

- HTML para estrutura;
- CSS para interface;
- JavaScript para regras de negócio;
- `localStorage` para persistência local;
- Supabase para autenticação real;
- Tesseract e QR code para leitura de notas fiscais;
- jsPDF para exportação de relatórios.

Em outras palavras, o sistema é um painel de gestão de estoque e produção, pensado para uso em navegador, com foco em operação prática e baixa complexidade de infraestrutura.

---

## Conclusão

Cada arquivo do repositório tem um papel bem definido:

- `index.html` organiza a interface e os modais;
- `style.css` dá estilo e usabilidade;
- `script.js` implementa a lógica funcional;
- `supabase-config.js` prepara a autenticação externa;
- `autorizacao.test.js` valida o comportamento esperado.

Juntos, eles formam uma aplicação funcional de controle de estoque e produção para um negócio de salgados, com foco em produtividade, rastreabilidade e organização operacional.
