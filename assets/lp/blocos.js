// Odisse · Biblioteca de blocos das landing pages (servicos.odisse.com.br)
//
// A RAIZ de todas as landing pages. Cada tipo de bloco diz:
//   - os campos que o painel mostra (formulário simples, sem mexer na página);
//   - o exemplo (para a Biblioteca de blocos e para o bloco novo);
//   - o desenho (o HTML que o site monta, com as classes de assets/lp/blocos.css).
// Mudou aqui (ou no blocos.css), mudaram todas as páginas: elas guardam só a lista de blocos e os textos.
//
// Usado por: assets/lp/pagina.js (site), painel/painel.js (montador) e worker/index.js (limpeza ao gravar).
// Por isso este arquivo não toca em window nem em document.
//
// Página = { slug, titulo, descricao, formulario, chamada, whatsapp, textoWhatsapp, blocos: [bloco] }
// Bloco  = { uid, tipo, dados: { ...campos do tipo } }
// Imagem = { ref, w, h } (enviada pelo painel, servida pela API em /img/<ref>) ou { caminho } (arquivo do site)

export const WHATSAPP = 'https://wa.me/5583991223088';
export const MARCA = 'https://marca.odisse.com.br';

// ---------------------------------------------------------------- campos

// tipos de campo: texto · area · link · imagem · chave · escolha · textos (lista de linhas) · lista (itens com campos)
const t = (id, rotulo, max, extra = {}) => ({ id, tipo: 'texto', rotulo, max, ...extra });
const a = (id, rotulo, max, extra = {}) => ({ id, tipo: 'area', rotulo, max, ...extra });
const img = (id, rotulo, formato, extra = {}) => ({ id, tipo: 'imagem', rotulo, formato, ...extra });
const lista = (id, rotulo, campos, extra = {}) => ({ id, tipo: 'lista', rotulo, campos, ...extra });

const ROTULO = t('rotulo', 'Rótulo acima do título', 40, { dica: 'Linha curta em maiúsculas, ex.: Como trabalhamos' });
const TITULO = t('titulo', 'Título', 160);
const TEXTO = a('texto', 'Texto', 900);
const BOTOES = { id: 'botoes', tipo: 'chave', rotulo: 'Botões de contato no fim do bloco' };

export const CAMPOS_PAGINA = [
  t('slug', 'Endereço', 60, { dica: 'servicos.odisse.com.br/<endereço>/ — só letras minúsculas, números e hífen' }),
  t('titulo', 'Título na aba do navegador', 90),
  a('descricao', 'Descrição para buscadores', 180),
  { id: 'formulario', tipo: 'link', rotulo: 'Formulário', dica: 'Ex.: /formulario-residencial/. Vazio = sem botão de formulário' },
  t('chamada', 'Texto do botão do formulário', 40),
  { id: 'whatsapp', tipo: 'chave', rotulo: 'Botão de WhatsApp ao lado' },
  t('textoWhatsapp', 'Texto do botão de WhatsApp', 40),
];

// ---------------------------------------------------------------- utilidades

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// texto longo: linha em branco separa parágrafos; quebra simples vira <br>
const paras = (s, classe) => String(s ?? '').trim().split(/\n\s*\n/).filter(Boolean)
  .map((p) => `<p${classe ? ` class="${classe}"` : ''}>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
const linha = (s) => esc(s).replace(/\n/g, '<br>');
const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const uid = () => Math.random().toString(36).slice(2, 10);

export function urlImagem(im, api) {
  if (!im) return '';
  if (im.ref) return `${api}/img/${encodeURIComponent(im.ref)}`;
  if (im.dataUrl) return im.dataUrl;
  if (im.caminho) return encodeURI(im.caminho);
  return '';
}

const SETA = '<span class="seta" aria-hidden="true">→</span>';
const ZAP = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35z"/><path d="M12 2C6.48 2 2 6.48 2 12c0 1.9.53 3.67 1.44 5.18L2 22l4.96-1.42A9.94 9.94 0 0 0 12 22c5.53 0 10.01-4.48 10.01-10S17.53 2 12 2zm0 18.13a8.08 8.08 0 0 1-4.13-1.13l-.3-.18-3.01.86.8-2.94-.19-.3a8.09 8.09 0 0 1-1.24-4.44c0-4.47 3.64-8.12 8.13-8.12 2.17 0 4.21.85 5.75 2.38a8.08 8.08 0 0 1 2.38 5.75c0 4.47-3.64 8.12-8.19 8.12z"/></svg>';

// botões de contato da página: formulário (areia) e WhatsApp (ardósia); sem formulário, o WhatsApp vira o principal
function botoes(ctx, { texto, centro, classe = '' } = {}) {
  const pg = ctx.pagina;
  const partes = [];
  if (pg.formulario) partes.push(`<a href="${esc(pg.formulario)}" class="lp-botao principal">${esc(texto || pg.chamada || 'Quero Solicitar um Orçamento')} ${SETA}</a>`);
  if (pg.whatsapp !== false) {
    const principal = !pg.formulario;
    const rot = principal && texto ? texto : (pg.textoWhatsapp || 'Quero Falar no WhatsApp');
    partes.push(`<a href="${WHATSAPP}" class="lp-botao ${principal ? 'principal' : 'zap'}" target="_blank" rel="noopener">${principal ? '' : ZAP}${esc(rot)}${principal ? ` ${SETA}` : ''}</a>`);
  }
  if (!partes.length) return '';
  return `<div class="lp-botoes${centro ? ' centro' : ''}${classe ? ` ${classe}` : ''}">${partes.join('')}</div>`;
}

function imagemOu(im, ctx, rotulo, classe = '', alt = '') {
  const u = urlImagem(im, ctx.api);
  if (u) return `<div class="lp-foto ${classe}"><img src="${esc(u)}" alt="${esc(alt || rotulo)}" loading="lazy" decoding="async"></div>`;
  return `<div class="lp-foto vazia ${classe}"><span>Imagem<br>${esc(rotulo)}</span></div>`;
}
const fitas = '<i class="fita f1"></i><i class="fita f2"></i><i class="fita f3"></i><i class="fita f4"></i>';
const comFitas = (html) => `<div class="lp-fitas">${fitas}${html}</div>`;

function cabecalho(d, { centro } = {}) {
  return `${d.rotulo ? `<div class="lp-rotulo">${esc(d.rotulo)}</div>` : ''}`
    + `${d.titulo ? `<h2 class="lp-titulo">${linha(d.titulo)}</h2>` : ''}`
    + `${d.texto ? `<div class="lp-texto">${paras(d.texto)}</div>` : ''}`;
}

// ---------------------------------------------------------------- tipos de bloco

export const TIPOS = [
  {
    id: 'abertura', nome: 'Abertura', grupo: 'Topo', topo: true, unico: true,
    desc: 'Primeira tela inteira: imagem de fundo com véu, título, texto, números e os botões de contato.',
    campos: [
      img('imagem', 'Imagem de fundo', 'paisagem', { dica: 'Horizontal, a maior possível. Fica atrás do véu ardósia.' }),
      t('titulo', 'Título', 160),
      a('texto', 'Texto', 400),
      lista('prova', 'Números', [t('valor', 'Número', 24), t('complemento', 'Complemento', 30)], { max: 3, rotuloItem: 'Número', dica: 'Linha curta sob o texto, ex.: +50 projetos · 5 anos de atuação' }),
      t('nota', 'Nota sob os botões', 80),
    ],
    exemplo: { titulo: 'Uma casa pensada pra ser sua.', texto: 'Rigor técnico, sensibilidade artística e leitura de contexto.', prova: [{ valor: '+100.000 m²', complemento: 'projetados' }, { valor: '+50 projetos', complemento: '' }, { valor: '5 anos', complemento: 'de atuação' }], nota: 'Resposta em até 1 dia útil.' },
    desenhar(d, ctx) {
      const u = urlImagem(d.imagem, ctx.api);
      const prova = (d.prova || []).filter((x) => x.valor || x.complemento)
        .map((x) => `<span><b>${esc(x.valor)}</b>${x.complemento ? ` ${esc(x.complemento)}` : ''}</span>`).join('<i class="ponto-sep" aria-hidden="true"></i>');
      return `<section class="lp-abertura">
        <div class="lp-abertura-fundo${u ? '' : ' vazia'}"${u ? ` style="background-image:url('${esc(u)}')"` : ''}>${u ? '' : '<span>Imagem de fundo</span>'}</div>
        <div class="lp-abertura-veu"></div>
        <div class="lp-moldura lp-abertura-conteudo">
          <div class="lp-traco"></div>
          <h1 class="lp-abertura-titulo">${linha(d.titulo)}</h1>
          ${d.texto ? `<div class="lp-abertura-texto">${paras(d.texto)}</div>` : ''}
          ${prova ? `<div class="lp-prova">${prova}</div>` : ''}
          ${botoes(ctx)}
          ${d.nota ? `<div class="lp-nota">${esc(d.nota)}</div>` : ''}
        </div>
      </section>`;
    },
  },
  {
    id: 'abertura-servicos', nome: 'Abertura com serviços', grupo: 'Topo', topo: true, unico: true,
    desc: 'Primeira tela da página inicial: título e texto curtos e, abaixo, os cartões dos serviços no ar (vêm do Catálogo).',
    campos: [t('titulo', 'Título', 160), a('texto', 'Texto', 400)],
    exemplo: { titulo: 'Escolha o serviço certo pra você.', texto: 'Escolha abaixo o tipo de projeto mais próximo do seu momento.' },
    desenhar(d) {
      return `<section class="lp-hub">
        <div class="lp-moldura"><div class="lp-hub-cab">
          <h1 class="lp-hub-titulo">${linha(d.titulo)}</h1>
          ${d.texto ? `<div class="lp-hub-texto">${paras(d.texto)}</div>` : ''}
        </div></div>
      </section>
      <section class="lp-hub-cartoes"><div class="lp-moldura"><div class="lp-grade-servicos" data-grid-servicos></div></div></section>`;
    },
  },
  {
    id: 'duas-colunas', nome: 'Duas colunas', grupo: 'Texto', cta: true,
    desc: 'Título largo e dois textos lado a lado, cada um com o seu subtítulo (ex.: residencial e comercial).',
    campos: [ROTULO, TITULO, lista('colunas', 'Colunas', [t('titulo', 'Subtítulo', 60), a('texto', 'Texto', 700)], { min: 2, max: 2, rotuloItem: 'Coluna' }), BOTOES],
    exemplo: { titulo: 'Um espaço que precisa de mudanças.', colunas: [{ titulo: 'Residencial', texto: 'Um apartamento recém-comprado, ainda vazio.' }, { titulo: 'Comercial', texto: 'Um espaço comercial recém-alugado.' }], botoes: true },
    desenhar(d, ctx) {
      return `<section><div class="lp-moldura">
        ${d.rotulo ? `<div class="lp-rotulo">${esc(d.rotulo)}</div>` : ''}
        <h2 class="lp-titulo largo">${linha(d.titulo)}</h2>
        <div class="lp-duas">${(d.colunas || []).map((c) => `<div class="lp-coluna"><h3>${esc(c.titulo)}</h3>${paras(c.texto)}</div>`).join('')}</div>
        ${d.botoes ? botoes(ctx, { centro: true, classe: 'fim' }) : ''}
      </div></section>`;
    },
  },
  {
    id: 'antes-depois', nome: 'Antes e depois', grupo: 'Imagens', cta: true,
    desc: 'Pares de imagens lado a lado, com as etiquetas Antes e Depois e o nome do projeto embaixo.',
    campos: [ROTULO, TITULO, TEXTO, lista('pares', 'Pares', [t('nome', 'Nome', 120), img('antes', 'Antes', 'paisagem'), img('depois', 'Depois', 'paisagem')], { max: 6, rotuloItem: 'Par' }), BOTOES],
    exemplo: { rotulo: 'Transformações', titulo: 'Transformações recentes', pares: [{ nome: 'Apartamento 2503' }], botoes: false },
    desenhar(d, ctx) {
      const lado = (im, nome, qual) => `<div class="lp-comparar-lado ${qual}">${comFitas(imagemOu(im, ctx, `${nome} — ${qual}`, 'p169'))}<span class="lp-etq-foto">${qual === 'antes' ? 'Antes' : 'Depois'}</span></div>`;
      return `<section><div class="lp-moldura">${cabecalho(d)}
        <div class="lp-comparacoes">${(d.pares || []).map((p) => `<div class="lp-comparacao"><div class="lp-comparar">${lado(p.antes, p.nome, 'antes')}${lado(p.depois, p.nome, 'depois')}</div><div class="lp-legenda-forte">${esc(p.nome)}</div></div>`).join('')}</div>
        ${d.botoes ? botoes(ctx, { centro: true, classe: 'fim' }) : ''}
      </div></section>`;
    },
  },
  {
    id: 'itens-numerados', nome: 'Itens numerados', grupo: 'Texto', cta: true,
    desc: 'Título, texto e de dois a seis itens numerados (I., II., III.…) em colunas. Serve ao diferencial e às etapas do serviço.',
    campos: [ROTULO, TITULO, TEXTO, lista('itens', 'Itens', [t('titulo', 'Título', 60), a('texto', 'Texto', 400)], { min: 1, max: 6, rotuloItem: 'Item', dica: 'A numeração é automática. Quatro itens ficam em quatro colunas; os outros casos, em três.' }), BOTOES],
    exemplo: { rotulo: 'Como trabalhamos', titulo: 'Do conceito à obra, em quatro passos.', itens: [{ titulo: 'Conceito', texto: 'Entendemos o terreno e o modo de viver.' }, { titulo: 'Projeto Legal', texto: 'Documentação para aprovação.' }, { titulo: 'Executivo', texto: 'Detalhamento completo.' }, { titulo: 'Acompanhamento', texto: 'Suporte durante a obra.' }], botoes: true },
    desenhar(d, ctx) {
      const itens = d.itens || [];
      return `<section><div class="lp-moldura">${cabecalho(d)}
        <div class="lp-numerados${itens.length === 4 ? ' c4' : ''}">${itens.map((it, i) => `<div class="lp-numerado"><span class="lp-num">${ROMANOS[i] || i + 1}.</span><h3>${esc(it.titulo)}</h3>${paras(it.texto)}</div>`).join('')}</div>
        ${d.botoes ? botoes(ctx, { centro: true, classe: 'fim' }) : ''}
      </div></section>`;
    },
  },
  {
    id: 'projetos', nome: 'Projetos', grupo: 'Imagens', cta: true,
    desc: 'Grade de projetos em duas colunas: imagem com fitas, nome, lugar e área; etiqueta e síntese opcionais.',
    campos: [ROTULO, TITULO, TEXTO,
      lista('projetos', 'Projetos', [img('imagem', 'Imagem', 'paisagem'), t('nome', 'Nome', 120), t('local', 'Lugar', 60), t('area', 'Área', 30), t('tipo', 'Etiqueta sobre a imagem', 30), a('sintese', 'Síntese', 300)], { max: 8, rotuloItem: 'Projeto' }),
      t('chamada', 'Texto do botão do formulário neste bloco', 40, { dica: 'Vazio = o texto da página' }), BOTOES],
    exemplo: { rotulo: 'Projetos', titulo: 'Projetos que já ganharam forma', projetos: [{ nome: 'Residência YVC', local: 'João Pessoa, PB', area: '480 m²' }, { nome: 'Residência FAF', local: 'Bananeiras, PB', area: '240 m²' }], botoes: true },
    desenhar(d, ctx) {
      return `<section id="projetos"><div class="lp-moldura">${cabecalho(d)}
        <div class="lp-projetos">${(d.projetos || []).map((p) => `<div class="lp-projeto">${comFitas(imagemOu(p.imagem, ctx, p.nome, 'p32', p.nome) + (p.tipo ? `<span class="lp-etq-foto">${esc(p.tipo)}</span>` : ''))}
          <div class="lp-legenda"><b>${esc(p.nome)}</b><span>${[p.local, p.area].filter(Boolean).map(esc).join(' · ')}</span>${p.sintese ? `<p>${esc(p.sintese)}</p>` : ''}</div></div>`).join('')}</div>
        ${d.botoes ? botoes(ctx, { centro: true, classe: 'fim', texto: d.chamada }) : ''}
      </div></section>`;
    },
  },
  {
    id: 'escopo', nome: 'Escopo', grupo: 'Texto', cta: true,
    desc: 'O que o cliente recebe: lista em duas colunas com marcadores e uma imagem em faixa embaixo.',
    campos: [ROTULO, TITULO, TEXTO, { id: 'itens', tipo: 'textos', rotulo: 'Itens', max: 12, maxItem: 200 }, img('imagem', 'Imagem em faixa', 'faixa', { dica: 'Proporção 3:1' }), BOTOES],
    exemplo: { rotulo: 'Escopo', titulo: 'O que você recebe', itens: ['Projeto do conceito à execução', 'Acompanhamento da aprovação', 'Compatibilização com complementares', 'Suporte técnico até a entrega'], botoes: false },
    desenhar(d, ctx) {
      return `<section id="escopo"><div class="lp-moldura">${cabecalho(d)}
        <div class="lp-escopo">${(d.itens || []).filter(Boolean).map((x) => `<div class="lp-escopo-item"><i aria-hidden="true"></i>${esc(x)}</div>`).join('')}</div>
        ${d.imagem || ctx.vazias ? imagemOu(d.imagem, ctx, 'Imagem em faixa', 'p31 lp-escopo-foto') : ''}
        ${d.botoes ? botoes(ctx, { centro: true, classe: 'fim' }) : ''}
      </div></section>`;
    },
  },
  {
    id: 'texto-imagens', nome: 'Texto e duas imagens', grupo: 'Imagens', cta: true,
    desc: 'Texto à esquerda e duas imagens verticais com legenda à direita (ex.: acompanhamento de obra).',
    campos: [ROTULO, TITULO, TEXTO, lista('imagens', 'Imagens', [img('imagem', 'Imagem', 'retrato'), t('legenda', 'Legenda', 120)], { min: 1, max: 2, rotuloItem: 'Imagem' }), BOTOES],
    exemplo: { rotulo: 'Do papel à obra', titulo: 'Acompanhamos até o último detalhe', imagens: [{ legenda: 'Visita técnica' }, { legenda: 'Obra em execução' }], botoes: false },
    desenhar(d, ctx) {
      return `<section><div class="lp-moldura lp-lado-a-lado">
        <div>${cabecalho(d)}${d.botoes ? botoes(ctx, { classe: 'fim-esq' }) : ''}</div>
        <div class="lp-duas-fotos">${(d.imagens || []).map((x) => `<div>${comFitas(imagemOu(x.imagem, ctx, x.legenda || 'Imagem', 'p34', x.legenda))}<div class="lp-legenda-fina">${esc(x.legenda)}</div></div>`).join('')}</div>
      </div></section>`;
    },
  },
  {
    id: 'perguntas', nome: 'Perguntas frequentes', grupo: 'Texto',
    desc: 'Perguntas que abrem e fecham, centradas. Cada resposta pode levar um botão para outra página. Vai também para o Google como FAQ.',
    campos: [ROTULO, TITULO, TEXTO, lista('perguntas', 'Perguntas', [t('pergunta', 'Pergunta', 200), a('resposta', 'Resposta', 1200), { id: 'link', tipo: 'link', rotulo: 'Link do botão (opcional)' }, t('botao', 'Texto do botão (opcional)', 40)], { max: 15, rotuloItem: 'Pergunta' })],
    exemplo: { rotulo: 'Dúvidas frequentes', titulo: 'Perguntas antes de começar', perguntas: [{ pergunta: 'Quanto custa um projeto?', resposta: 'Fazemos um orçamento a partir de uma conversa inicial.' }, { pergunta: 'Vocês atendem em outras cidades?', resposta: 'Sim, em todo o Brasil.' }] },
    desenhar(d) {
      return `<section><div class="lp-moldura lp-centro">${cabecalho(d)}
        <div class="lp-perguntas">${(d.perguntas || []).map((q, i) => `<details class="lp-pergunta"${i === 0 ? ' open' : ''}><summary>${esc(q.pergunta)}<i class="lp-mais" aria-hidden="true"></i></summary>
          <div class="lp-resposta">${paras(q.resposta)}${q.link && q.botao ? `<a href="${esc(q.link)}" class="lp-botao principal">${esc(q.botao)} ${SETA}</a>` : ''}</div></details>`).join('')}</div>
      </div></section>`;
    },
  },
  {
    id: 'autoria', nome: 'Autoria', grupo: 'Faixa escura', escuro: true,
    desc: 'Na faixa ardósia: foto quadrada com fitas à esquerda, quem conduz os projetos à direita.',
    campos: [img('imagem', 'Foto', 'quadrada'), ROTULO, TITULO, a('texto', 'Texto', 1800), t('nomes', 'Nomes', 120, { dica: 'Linha em maiúsculas sob o texto' })],
    exemplo: { rotulo: 'Autoria', titulo: 'Os Arquitetos', texto: 'Cid Clementino e Nathalia Linhares conduzem pessoalmente cada projeto.', nomes: 'CID CLEMENTINO · NATHALIA LINHARES' },
    desenhar(d, ctx) {
      return `<section id="equipe"><div class="lp-moldura lp-lado-a-lado">
        <div class="lp-autoria-foto">${comFitas(imagemOu(d.imagem, ctx, d.nomes || 'Foto', 'p11', d.nomes))}</div>
        <div>${cabecalho(d)}${d.nomes ? `<div class="lp-nomes">${esc(d.nomes)}</div>` : ''}</div>
      </div></section>`;
    },
  },
  {
    id: 'numeros', nome: 'Números', grupo: 'Faixa escura', escuro: true,
    desc: 'Na faixa ardósia: caixa areia com até quatro números grandes e a legenda de cada um.',
    campos: [lista('itens', 'Números', [t('valor', 'Número', 24), t('legenda', 'Legenda', 60)], { min: 1, max: 4, rotuloItem: 'Número' })],
    exemplo: { itens: [{ valor: '+100.000 m²', legenda: 'de arquitetura projetada' }, { valor: '+50 projetos', legenda: 'entregues' }, { valor: '5 anos', legenda: 'de atuação contínua' }] },
    desenhar(d) {
      const itens = d.itens || [];
      return `<section><div class="lp-moldura"><div class="lp-numeros" style="--n:${Math.max(1, itens.length)}">${itens.map((x) => `<div class="lp-numero"><b>${esc(x.valor)}</b><span>${esc(x.legenda)}</span></div>`).join('')}</div></div></section>`;
    },
  },
  {
    id: 'chamada-final', nome: 'Chamada final', grupo: 'Faixa escura', escuro: true,
    desc: 'Na faixa ardósia, centrada: rótulo, título, texto e os botões de contato.',
    campos: [ROTULO, TITULO, TEXTO, t('chamada', 'Texto do botão principal', 40, { dica: 'Vazio = o texto da página' })],
    exemplo: { rotulo: 'Comece agora', titulo: 'Vamos começar seu projeto?', texto: 'Preencha o formulário e retornaremos em até 1 dia útil.' },
    desenhar(d, ctx) {
      return `<section id="contato" class="lp-final"><div class="lp-moldura lp-centro">${cabecalho(d)}${botoes(ctx, { centro: true, texto: d.chamada })}</div></section>`;
    },
  },
];

export const tipoDe = (id) => TIPOS.find((x) => x.id === id);
export const GRUPOS = ['Topo', 'Texto', 'Imagens', 'Faixa escura'];

// página nova: os blocos escolhidos, com os campos vazios (botões ligados onde o tipo os oferece)
export function vazioDe(tipo) {
  const dados = {};
  for (const c of tipo.campos) {
    if (c.tipo === 'lista') dados[c.id] = Array.from({ length: c.min || 1 }, () => Object.fromEntries(c.campos.map((s) => [s.id, s.tipo === 'imagem' ? null : ''])));
    else if (c.tipo === 'textos') dados[c.id] = [''];
    else if (c.tipo === 'chave') dados[c.id] = true;
    else if (c.tipo === 'imagem') dados[c.id] = null;
    else dados[c.id] = '';
  }
  return dados;
}
export const novoBloco = (tipoId) => ({ uid: uid(), tipo: tipoId, dados: vazioDe(tipoDe(tipoId)) });

// ---------------------------------------------------------------- limpeza (painel e API usam a mesma)

const curto = (s, n) => (typeof s === 'string' ? s.replace(/\r\n?/g, '\n').slice(0, n) : '');
export function limparLink(s) {
  const l = curto(s, 500).trim();
  if (!l) return '';
  if (l.startsWith('/') && !l.startsWith('//')) return l;
  if (/^#[\w-]*$/.test(l)) return l;
  try { const u = new URL(l); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch { return ''; }
}
export function limparImagem(im) {
  if (!im || typeof im !== 'object') return null;
  if (typeof im.ref === 'string' && /^[a-z0-9][a-z0-9_-]{3,80}$/i.test(im.ref)) {
    return { ref: im.ref, w: Number.isFinite(im.w) ? Math.round(im.w) : 0, h: Number.isFinite(im.h) ? Math.round(im.h) : 0 };
  }
  if (typeof im.caminho === 'string' && /^\/[\p{L}\p{N}/_. -]+\.(jpe?g|png|webp)$/iu.test(im.caminho) && !im.caminho.includes('..')) return { caminho: im.caminho };
  return null;
}
function limparCampo(c, v) {
  switch (c.tipo) {
    case 'texto': return curto(v, c.max || 200).replace(/\n/g, ' ');
    case 'area': return curto(v, c.max || 2000);
    case 'link': return limparLink(v);
    case 'imagem': return limparImagem(v);
    case 'chave': return v === true;
    case 'escolha': return c.opcoes.some((o) => o[0] === v) ? v : c.opcoes[0][0];
    case 'textos': return (Array.isArray(v) ? v : []).slice(0, c.max || 20).map((x) => curto(x, c.maxItem || 200).replace(/\n/g, ' '));
    case 'lista': return (Array.isArray(v) ? v : []).slice(0, c.max || 20)
      .map((it) => Object.fromEntries(c.campos.map((s) => [s.id, limparCampo(s, it && typeof it === 'object' ? it[s.id] : undefined)])));
    default: return null;
  }
}
export const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
export const RESERVADOS = new Set(['painel', 'assets', 'images', 'img', 'api', 'lp', 'formulario-residencial', 'formulario-interiores']);

export function limparPagina(p) {
  p = p && typeof p === 'object' ? p : {};
  const pg = {};
  for (const c of CAMPOS_PAGINA) pg[c.id] = limparCampo(c, p[c.id]);
  pg.slug = String(pg.slug || '').toLowerCase();
  if (p.whatsapp === undefined) pg.whatsapp = true;
  const vistos = new Set();
  pg.blocos = (Array.isArray(p.blocos) ? p.blocos : []).slice(0, 30).map((b) => {
    const tipo = b && tipoDe(b.tipo);
    if (!tipo) return null;
    let id = typeof b.uid === 'string' && /^[a-z0-9]{4,12}$/.test(b.uid) ? b.uid : uid();
    while (vistos.has(id)) id = uid();
    vistos.add(id);
    const d = b.dados && typeof b.dados === 'object' ? b.dados : {};
    return { uid: id, tipo: tipo.id, dados: Object.fromEntries(tipo.campos.map((c) => [c.id, limparCampo(c, d[c.id])])) };
  }).filter(Boolean);
  return pg;
}

// ---------------------------------------------------------------- desenho da página inteira

// moldura da marca: barra do Arquitetos (Roda + ODISSE + ARQUITETOS), rodapé ardósia com a assinatura, botão flutuante
const barra = `<header class="lp-barra"><a class="lp-marca" href="/inicio/" aria-label="Odisse Arquitetos — início">
  <i class="lp-selo" aria-hidden="true"></i><i class="lp-logotipo" aria-hidden="true"></i><span class="lp-nucleo">Arquitetos</span></a></header>`;

const rodape = `<footer class="lp-rodape"><div class="lp-moldura lp-centro">
  <div class="lp-lema">Creative <i class="ponto-sep" aria-hidden="true"></i> Reserve</div>
  <i class="lp-assinatura" role="img" aria-label="Odisse, Estúdio de Arquitetura e Design"></i>
  <div class="lp-rodape-cidade">João Pessoa, PB. Atendimento em todo o Brasil.</div>
  <nav class="lp-rodape-links" aria-label="Canais do Odisse">
    <a href="https://www.odisse.com.br/" target="_blank" rel="noopener">odisse.com.br</a>
    <a href="https://www.instagram.com/odisseestudio/" target="_blank" rel="noopener">Instagram</a>
    <a href="https://www.tiktok.com/@odisse.estudio" target="_blank" rel="noopener">TikTok</a>
    <a href="https://www.youtube.com/@odisseestudio" target="_blank" rel="noopener">YouTube</a>
    <a href="https://odisse.substack.com/" target="_blank" rel="noopener">Substack</a>
  </nav>
</div></footer>`;

const flutuante = `<a href="${WHATSAPP}" class="lp-flutuante" target="_blank" rel="noopener">${ZAP}Falar no WhatsApp</a>`;

// um bloco só (Biblioteca de blocos, miniaturas do painel)
export function desenharBloco(bloco, ctx) {
  const tipo = tipoDe(bloco.tipo);
  if (!tipo) return '';
  const html = tipo.desenhar(bloco.dados || {}, ctx);
  if (tipo.topo) return `<div class="lp-tela${tipo.id === 'abertura-servicos' ? ' clara' : ''}">${barra}${html}</div>`;
  return tipo.escuro ? `<div class="lp-faixa-escura">${html}</div>` : html;
}

// página inteira: barra + topo (primeira tela), blocos separados por filete, blocos escuros juntos numa faixa só, rodapé
export function desenharPagina(pagina, { api = '', vazias = false } = {}) {
  const ctx = { pagina, api, vazias };
  const blocos = (pagina.blocos || []).filter((b) => tipoDe(b.tipo));
  let html = '';
  let i = 0;
  const primeiro = blocos[0] && tipoDe(blocos[0].tipo);
  if (primeiro?.topo) {
    html += `<div class="lp-tela${primeiro.id === 'abertura-servicos' ? ' clara' : ''}">${barra}${primeiro.desenhar(blocos[0].dados, ctx)}</div>`;
    i = 1;
  } else {
    html += barra;
  }
  let escuro = false;
  let antes = i > 0; // já há um bloco acima (o de topo)
  for (; i < blocos.length; i++) {
    const tipo = tipoDe(blocos[i].tipo);
    if (tipo.topo) continue; // só o primeiro bloco pode ser de topo
    const bEsc = !!tipo.escuro;
    if (bEsc && !escuro) { html += `${antes ? '<hr class="lp-filete">' : ''}<div class="lp-faixa-escura">`; escuro = true; }
    else if (!bEsc && escuro) { html += '</div><hr class="lp-filete">'; escuro = false; }
    else if (antes) html += `<hr class="lp-filete${escuro ? ' claro' : ''}">`;
    html += tipo.desenhar(blocos[i].dados, ctx);
    antes = true;
  }
  if (escuro) html += '</div>';
  return html + rodape + flutuante;
}

// FAQ para o Google (schema.org), a partir dos blocos de perguntas
export function faqLd(pagina) {
  const qs = (pagina.blocos || []).filter((b) => b.tipo === 'perguntas').flatMap((b) => b.dados.perguntas || []).filter((q) => q.pergunta && q.resposta);
  if (!qs.length) return null;
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qs.map((q) => ({ '@type': 'Question', name: q.pergunta, acceptedAnswer: { '@type': 'Answer', text: q.resposta } })) };
}
