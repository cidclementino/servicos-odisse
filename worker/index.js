// Odisse · API do servicos.odisse.com.br (Cloudflare Worker + KV)
//
// O catálogo de serviços e produtos do Odisse: tudo o que está no ar, em desenvolvimento ou a desenvolver,
// gerido pelo painel oculto servicos.odisse.com.br/painel/ (senha). O que está NO AR e marcado para o
// site aparece no grid de serviços da página /inicio/, na ordem do catálogo.
//
// Binding (wrangler.toml): KV Namespace `SERVICOS`
//   catalogo        -> { versao, atualizado, produtos: [produto] } (a ordem da lista é a ordem do grid)
//   img:<ref>       -> imagem de capa (binário; content-type nos metadados)
//   ver:<iso>       -> catálogo anterior a cada gravação (as 20 últimas)
//   pagina:<id>     -> landing page de um produto (id do produto) ou da página inicial ("inicio"):
//                      { id, versao, atualizado, publicadoEm, casca, rascunho: pagina, publicado: pagina | null }
//   lp:<endereço>   -> a página publicada, como o site lê
// Secrets: SERVICOS_SENHA -> senha do painel (Authorization: Bearer <senha>)
//          SERVICOS_GITHUB_TOKEN (opcional) -> cria a casca /<endereço>/index.html no repositório quando uma página
//          nova é publicada; sem ele, a página fica em /lp/?p=<endereço> até a casca ser criada
//
// Landing pages: a página guarda só a lista de blocos e os textos; o desenho é o da biblioteca de blocos
// (assets/lp/blocos.js + blocos.css), a mesma que este Worker usa para limpar o que chega. As páginas que já
// existiam (residencial, interiores, inicio) nascem de _data/paginas/*.json até a primeira publicação pelo painel.
//
// Produto:
//   { id, nome, trilho, degrau, situacao, noSite, servicoPgt, publico: { titulo, texto, chamada, link, imagem }, notas, atualizado }
//   servicoPgt (20/11): o serviço do Plano Geral de Trabalho a que o produto se liga (srv_…; vários produtos podem
//   apontar para o mesmo serviço). A lista vem do Universo pela ligação UNIVERSO (ponto de entrada Servicos).
//   trilho   : cliente | corretores | construtoras | escritorios
//   degrau   : entrada (grátis) | leve (pago leve) | contrato (serviço principal)
//   situacao : a-desenvolver | desenvolvimento | no-ar | pausado | arquivado
//   imagem   : { ref, w, h } (enviada pelo painel, servida em /img/<ref>) ou { caminho } (arquivo do próprio site)
//
// Rotas públicas
//   GET  /api/produtos            -> produtos no ar e marcados para o site, na ordem, só os campos públicos
//   GET  /img/:ref                -> imagem
//   GET  /api/paginas/:endereço   -> página publicada ({ pagina })
// Rotas do painel (senha)
//   GET  /api/admin/catalogo      -> catálogo inteiro
//   PUT  /api/admin/catalogo      -> grava o catálogo inteiro ({ versao, produtos }); 409 se a versão mudou
//   PUT  /api/admin/imagens/:ref  -> grava imagem (corpo binário)
//   GET  /api/admin/versoes       -> versões guardadas (chave, data, quantos produtos)
//   GET  /api/admin/versao?chave= -> conteúdo de uma versão
//   GET  /api/admin/paginas       -> resumo das landing pages (endereço, blocos, publicada, mudanças pendentes)
//   GET  /api/admin/paginas/:id   -> registro da página (rascunho e publicada)
//   PUT  /api/admin/paginas/:id   -> grava o rascunho ({ versao, pagina }); 409 se a versão mudou
//   POST /api/admin/paginas/:id/publicar -> publica o rascunho ({ versao })
//   GET  /api/admin/previa/:endereço     -> rascunho, para a prévia no site (?previa)
//   GET  /api/admin/servicos-pgt         -> serviços do PGT (id, sigla, nome, dinâmica), lidos do Universo

import { limparPagina, limparImagem, limparLink, SLUG, RESERVADOS } from '../assets/lp/blocos.js';
import SEMENTE_RESIDENCIAL from '../_data/paginas/residencial.json';
import SEMENTE_INTERIORES from '../_data/paginas/interiores.json';
import SEMENTE_INICIO from '../_data/paginas/inicio.json';

const CORS_BASE = {
  'Access-Control-Allow-Methods': 'GET, HEAD, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
};
const ORIGENS = /^https:\/\/servicos\.odisse\.com\.br$|^https:\/\/(www\.)?odisse\.com\.br$|^https:\/\/universo\.odisse\.com\.br$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const MAX_IMG = 8 * 1024 * 1024;
const MAX_CATALOGO = 512 * 1024;
const MAX_VERSOES = 20;
const REF = /^[a-z0-9][a-z0-9_-]{3,80}$/i;
const ID = /^[a-z0-9][a-z0-9-]{1,60}$/;
const TIPOS_IMG = new Set(['image/webp', 'image/jpeg', 'image/png']);

export const TRILHOS = ['cliente', 'corretores', 'construtoras', 'escritorios'];
export const DEGRAUS = ['entrada', 'leve', 'contrato'];
export const SITUACOES = ['a-desenvolver', 'desenvolvimento', 'no-ar', 'pausado', 'arquivado'];

// primeiro catálogo (quando o KV está vazio): o que já está no ar no servicos e o que saiu da conversa de 20/11/2026
const p = (id, nome, trilho, degrau, situacao, noSite, publico, notas = '') =>
  ({ id, nome, trilho, degrau, situacao, noSite, publico: { titulo: '', texto: '', chamada: '', link: '', imagem: null, ...publico }, notas });
// produto do catálogo → serviço do PGT (os que já existiam no Universo em 20/11/2026)
export const SERVICO_PGT = {
  'projeto-residencial': 'srv_ne', 'projeto-interiores': 'srv_in', 'estudo-viabilidade': 'srv_ev', 'planejador-obra': 'srv_po',
  'sessao-projeto': 'srv_sp', 'avaliacao-compra': 'srv_av', 'ficha-terreno': 'srv_ft', 'dossie-construtoras': 'srv_do',
  'personalizacao-unidades': 'srv_pu', 'consultoria-computacional': 'srv_cc',
};
export const SEMENTE = [
  p('projeto-residencial', 'Projeto residencial', 'cliente', 'contrato', 'no-ar', true,
    { titulo: 'Projeto Residencial', texto: 'Um espaço que responde a como você vive — não a um modelo pronto.', chamada: 'Ver projeto', link: '/residencial/', imagem: { caminho: '/inicio/images/capa-residencial.jpg' } }),
  p('projeto-interiores', 'Projeto de interiores e ambientação', 'cliente', 'contrato', 'no-ar', true,
    { titulo: 'Projeto de Interiores e Ambientação', texto: 'Transformar o que já existe também é criar do zero.', chamada: 'Ver projeto', link: '/interiores/', imagem: { caminho: '/inicio/images/capa-interiores.jpg' } }),
  p('estudo-viabilidade', 'Estudo de viabilidade', 'cliente', 'contrato', 'desenvolvimento', true,
    { titulo: 'Estudo de Viabilidade', texto: 'Decida com clareza antes de investir.', chamada: 'Ver projeto', link: '/viabilidade/', imagem: { caminho: '/inicio/images/capa-viabilidade.jpg' } },
    'O cartão estava no grid da /inicio/, mas a página /viabilidade/ não existe no repositório. Volta ao grid quando a página estiver no ar.'),
  p('herma', 'Herma', 'cliente', 'entrada', 'no-ar', false,
    { titulo: 'Herma', texto: 'Descubra quanto dá para construir no seu terreno.', chamada: 'Consultar terreno', link: 'https://herma.odisse.com.br/' },
    'No ar em herma.odisse.com.br. Fora do grid até ter imagem de capa.'),
  p('planejador-obra', 'Planejador da obra', 'cliente', 'entrada', 'a-desenvolver', true,
    { titulo: 'Plano da sua obra', texto: 'Quanto custa, quanto tempo leva e o que perguntar antes de começar.', chamada: 'Fazer meu plano', link: '/planejador/' },
    'Grátis em troca do contato. Perguntas curtas; devolve o PDF "Plano da sua obra" (custo pelo CUB, honorário em faixa, prazos pelo PGT, riscos, perguntas). Depende da rotina do CUB.'),
  p('sessao-projeto', 'Sessão de projeto', 'cliente', 'leve', 'a-desenvolver', true,
    { titulo: 'Sessão de projeto', texto: 'Uma conversa de 90 minutos sobre o seu caso, com orientações por escrito.', chamada: 'Marcar sessão', link: '/sessao/' },
    'Preço fixo, abatido do projeto se fechar. Folha de orientações em até 48 h.'),
  p('avaliacao-compra', 'Avaliação antes de comprar', 'cliente', 'leve', 'a-desenvolver', true,
    { titulo: 'Avaliação antes de comprar', texto: 'Visite o imóvel com um arquiteto antes de fechar negócio.', chamada: 'Pedir avaliação', link: '/avaliacao/' },
    'Visita de ~1 h e relatório em 48–72 h. Não é vistoria nem laudo. Conferir se pede RRT.'),
  p('ficha-terreno', 'Ficha do terreno', 'corretores', 'entrada', 'a-desenvolver', false,
    { titulo: 'Ficha do terreno', texto: 'O que dá para construir no terreno, numa folha para o corretor vender.' },
    'Grátis para o corretor, entregue pelo WhatsApp em 24–48 h; volumetria gerada a partir do Herma. Material para parceiros, fora do grid.'),
  p('dossie-construtoras', 'Dossiê para construtoras', 'construtoras', 'entrada', 'a-desenvolver', false,
    { titulo: 'Projeto para obras licitadas', texto: 'Parceria de projeto para construtoras em contratação integrada e semi-integrada.' },
    'Apresentação + qualificação técnica pronta para anexar; depois, uma folha por licitação a partir do Radar. Material para parceiros, fora do grid.'),
  p('personalizacao-unidades', 'Personalização de unidades', 'construtoras', 'contrato', 'a-desenvolver', false,
    { titulo: 'Personalização de unidades', texto: 'Mudanças de planta e interiores para quem compra na planta.' }),
  p('consultoria-computacional', 'Consultoria em design computacional', 'escritorios', 'contrato', 'a-desenvolver', false,
    { titulo: 'Consultoria em design computacional', texto: 'Geometria complexa e Grasshopper para outros escritórios de arquitetura.' }),
];

// ---------------------------------------------------------------- utilidades

const corsDe = (request) => {
  const o = request.headers.get('Origin') || '';
  return { ...CORS_BASE, 'Access-Control-Allow-Origin': ORIGENS.test(o) ? o : 'https://servicos.odisse.com.br' };
};
const json = (request, data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsDe(request), ...extra } });
const erro = (request, msg, status) => json(request, { error: msg }, status);

function autorizado(request, env) {
  const senha = env.SERVICOS_SENHA;
  if (!senha) return false;
  const auth = request.headers.get('Authorization') || '';
  const dada = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (dada.length !== senha.length) return false;
  let dif = 0;
  for (let i = 0; i < senha.length; i++) dif |= dada.charCodeAt(i) ^ senha.charCodeAt(i);
  return dif === 0;
}

const curto = (s, n) => (typeof s === 'string' ? s.trim().slice(0, n) : '');
const umDe = (v, lista, padrao) => (lista.includes(v) ? v : padrao);

export function limparProduto(x) {
  const pub = x.publico || {};
  return {
    id: String(x.id || ''),
    nome: curto(x.nome, 120),
    trilho: umDe(x.trilho, TRILHOS, 'cliente'),
    degrau: umDe(x.degrau, DEGRAUS, 'contrato'),
    situacao: umDe(x.situacao, SITUACOES, 'a-desenvolver'),
    noSite: x.noSite !== false,
    servicoPgt: typeof x.servicoPgt === 'string' && /^srv_[A-Za-z0-9_]{1,40}$/.test(x.servicoPgt) ? x.servicoPgt
      : x.servicoPgt === undefined ? SERVICO_PGT[x.id] || '' : '',
    publico: {
      titulo: curto(pub.titulo, 120),
      texto: curto(pub.texto, 240),
      chamada: curto(pub.chamada, 40),
      link: limparLink(pub.link),
      imagem: limparImagem(pub.imagem),
    },
    notas: curto(x.notas, 4000),
    atualizado: typeof x.atualizado === 'string' ? x.atualizado.slice(0, 30) : '',
  };
}

async function lerCatalogo(env) {
  const c = await env.SERVICOS.get('catalogo', 'json');
  // catálogo gravado antes de 20/11/2026: cada produto conhecido ganha o serviço do PGT a que se liga
  if (c && Array.isArray(c.produtos)) return { ...c, produtos: c.produtos.map((x) => (x.servicoPgt === undefined ? { ...x, servicoPgt: SERVICO_PGT[x.id] || '' } : x)) };
  return { versao: 0, atualizado: '', produtos: SEMENTE.map(limparProduto) };
}

export function publicos(catalogo, base) {
  return catalogo.produtos
    .filter((x) => x.situacao === 'no-ar' && x.noSite && x.publico.titulo && x.publico.link)
    .map((x) => {
      const im = x.publico.imagem;
      const imagem = im?.ref ? { url: `${base}/img/${im.ref}`, w: im.w, h: im.h } : im?.caminho ? { url: im.caminho } : null;
      return {
        id: x.id,
        titulo: x.publico.titulo,
        texto: x.publico.texto,
        chamada: x.publico.chamada || 'Saiba mais',
        link: x.publico.link,
        externo: /^https?:/.test(x.publico.link) && !/^https:\/\/servicos\.odisse\.com\.br/.test(x.publico.link),
        imagem,
        trilho: x.trilho,
        degrau: x.degrau,
      };
    });
}


// ---------------------------------------------------------------- landing pages

const ID_PAGINA = /^(inicio|[a-z0-9][a-z0-9-]{1,60})$/;
const MAX_PAGINA = 256 * 1024;
// páginas que já existiam no site: valem como publicadas até a primeira publicação pelo painel
export const SEMENTES_PAGINAS = {
  'projeto-residencial': SEMENTE_RESIDENCIAL,
  'projeto-interiores': SEMENTE_INTERIORES,
  inicio: SEMENTE_INICIO,
};
const CASCAS_NO_REPO = new Set(['residencial', 'interiores', 'inicio']);

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// casca = o endereço que já tem /<endereço>/index.html no site
const temCasca = (r, slug) => CASCAS_NO_REPO.has(slug) || r.casca === slug;

function registroSemente(id) {
  const sem = SEMENTES_PAGINAS[id];
  if (!sem) return null;
  const pg = limparPagina(sem);
  return { id, versao: 0, atualizado: '', publicadoEm: '', casca: pg.slug, semente: true, rascunho: pg, publicado: pg };
}

async function lerRegistro(env, id) {
  const r = await env.SERVICOS.get(`pagina:${id}`, 'json');
  return r || registroSemente(id);
}

async function todosRegistros(env) {
  const lista = [];
  let cursor;
  do {
    const vez = await env.SERVICOS.list({ prefix: 'pagina:', cursor });
    lista.push(...vez.keys.map((k) => k.name.slice(7)));
    cursor = vez.list_complete ? null : vez.cursor;
  } while (cursor);
  const ids = new Set([...lista, ...Object.keys(SEMENTES_PAGINAS)]);
  const regs = await Promise.all([...ids].map((id) => lerRegistro(env, id)));
  return regs.filter(Boolean);
}

const resumo = (r) => ({
  id: r.id,
  slug: r.rascunho.slug,
  slugPublicado: r.publicado?.slug || '',
  titulo: r.rascunho.titulo,
  blocos: r.rascunho.blocos.length,
  publicadoEm: r.publicadoEm,
  publicada: !!r.publicado,
  pendente: !r.publicado || !igual(r.rascunho, r.publicado),
  casca: temCasca(r, r.rascunho.slug),
  atualizado: r.atualizado,
});

async function gravarPagina(request, env, id) {
  const txt = await request.text();
  if (txt.length > MAX_PAGINA) return erro(request, 'página grande demais', 413);
  let corpo;
  try { corpo = JSON.parse(txt); } catch { return erro(request, 'JSON inválido', 400); }
  const atual = await lerRegistro(env, id);
  if (atual && Number(corpo.versao) !== atual.versao) return json(request, { error: 'a página mudou em outro lugar', registro: atual }, 409);

  const pg = limparPagina(corpo.pagina);
  if (!SLUG.test(pg.slug)) return erro(request, 'endereço inválido: use letras minúsculas, números e hífen', 400);
  if (RESERVADOS.has(pg.slug) || (pg.slug === 'inicio' && id !== 'inicio')) return erro(request, `o endereço /${pg.slug}/ é reservado`, 400);
  const outros = (await todosRegistros(env)).filter((r) => r.id !== id);
  const dono = outros.find((r) => r.rascunho.slug === pg.slug || r.publicado?.slug === pg.slug);
  if (dono) return erro(request, `o endereço /${pg.slug}/ já é de outra página (${dono.id})`, 400);
  if (!pg.blocos.length) return erro(request, 'a página precisa de pelo menos um bloco', 400);

  const reg = {
    id,
    versao: (atual?.versao || 0) + 1,
    atualizado: new Date().toISOString(),
    publicadoEm: atual?.publicadoEm || '',
    casca: atual?.casca || '',
    rascunho: pg,
    publicado: atual?.publicado || null,
  };
  await env.SERVICOS.put(`pagina:${id}`, JSON.stringify(reg));
  return json(request, { registro: reg, resumo: resumo(reg) });
}

// cria /<endereço>/index.html no repositório (layout "lp"), para a página ter endereço próprio
async function criarCasca(env, slug) {
  if (CASCAS_NO_REPO.has(slug)) return { ok: true };
  const token = env.SERVICOS_GITHUB_TOKEN;
  if (!token) return { ok: false, motivo: 'sem token' };
  const repo = env.GITHUB_REPO || 'cidclementino/servicos-odisse';
  const url = `https://api.github.com/repos/${repo}/contents/${slug}/index.html`;
  const cab = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'servicos-odisse', 'X-GitHub-Api-Version': '2022-11-28' };
  const ja = await fetch(url, { headers: cab });
  if (ja.ok) return { ok: true };
  const conteudo = `---\nlayout: lp\npagina: ${slug}\n---\n`;
  const r = await fetch(url, {
    method: 'PUT', headers: { ...cab, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Casca da landing page /${slug}/ (painel)`, content: btoa(conteudo) }),
  });
  return r.ok ? { ok: true } : { ok: false, motivo: `GitHub ${r.status}` };
}

async function publicarPagina(request, env, id) {
  let corpo = {};
  try { corpo = await request.json(); } catch { /* sem corpo */ }
  const atual = await lerRegistro(env, id);
  if (!atual) return erro(request, 'página não encontrada', 404);
  if (Number(corpo.versao) !== atual.versao) return json(request, { error: 'a página mudou em outro lugar', registro: atual }, 409);

  const pg = atual.rascunho;
  const antigo = atual.publicado?.slug;
  const reg = { ...atual, semente: undefined, versao: atual.versao + 1, publicado: pg, publicadoEm: new Date().toISOString() };
  let aviso = '';
  if (!temCasca(reg, pg.slug)) {
    const c = await criarCasca(env, pg.slug).catch((e) => ({ ok: false, motivo: e.message }));
    if (c.ok) reg.casca = pg.slug;
    if (!c.ok) aviso = `A página está no ar em /lp/?p=${pg.slug}. O endereço /${pg.slug}/ precisa da casca no site (${c.motivo}).`;
  }
  await env.SERVICOS.put(`lp:${pg.slug}`, JSON.stringify(pg));
  if (antigo && antigo !== pg.slug) await env.SERVICOS.delete(`lp:${antigo}`);
  await env.SERVICOS.put(`pagina:${id}`, JSON.stringify(reg));
  return json(request, { registro: reg, resumo: resumo(reg), aviso });
}

async function paginaPublica(env, slug) {
  const pg = await env.SERVICOS.get(`lp:${slug}`, 'json');
  if (pg) return pg;
  // semente: só enquanto a página dela não foi publicada pelo painel
  for (const id of Object.keys(SEMENTES_PAGINAS)) {
    const sem = SEMENTES_PAGINAS[id];
    if (sem.slug !== slug) continue;
    const reg = await env.SERVICOS.get(`pagina:${id}`, 'json');
    if (!reg || !reg.publicado) return limparPagina(sem);
  }
  return null;
}

// ---------------------------------------------------------------- rotas

async function gravarCatalogo(request, env) {
  const txt = await request.text();
  if (txt.length > MAX_CATALOGO) return erro(request, 'catálogo grande demais', 413);
  let corpo;
  try { corpo = JSON.parse(txt); } catch { return erro(request, 'JSON inválido', 400); }
  if (!corpo || !Array.isArray(corpo.produtos)) return erro(request, 'faltam os produtos', 400);

  const atual = await lerCatalogo(env);
  if (Number(corpo.versao) !== atual.versao) {
    return json(request, { error: 'o catálogo mudou em outro lugar', catalogo: atual }, 409);
  }

  const vistos = new Set();
  const produtos = [];
  for (const x of corpo.produtos) {
    const pr = limparProduto(x || {});
    if (!ID.test(pr.id)) return erro(request, `id inválido: ${pr.id || '(vazio)'}`, 400);
    if (vistos.has(pr.id)) return erro(request, `id repetido: ${pr.id}`, 400);
    if (!pr.nome) return erro(request, `produto sem nome: ${pr.id}`, 400);
    vistos.add(pr.id);
    const antes = atual.produtos.find((a) => a.id === pr.id);
    const igual = antes && JSON.stringify({ ...antes, atualizado: '' }) === JSON.stringify({ ...pr, atualizado: '' });
    pr.atualizado = igual ? antes.atualizado : new Date().toISOString();
    produtos.push(pr);
  }

  // guarda o anterior (se já havia um gravado) e poda as versões antigas
  if (atual.versao > 0) {
    await env.SERVICOS.put(`ver:${new Date().toISOString()}`, JSON.stringify(atual));
    const vers = await env.SERVICOS.list({ prefix: 'ver:' });
    const velhas = vers.keys.map((k) => k.name).sort().slice(0, Math.max(0, vers.keys.length - MAX_VERSOES));
    await Promise.all(velhas.map((k) => env.SERVICOS.delete(k)));
  }

  const novo = { versao: atual.versao + 1, atualizado: new Date().toISOString(), produtos };
  await env.SERVICOS.put('catalogo', JSON.stringify(novo));
  return json(request, novo);
}

async function gravarImagem(request, env, ref) {
  if (!REF.test(ref)) return erro(request, 'nome de imagem inválido', 400);
  const tipo = (request.headers.get('Content-Type') || '').split(';')[0].trim();
  if (!TIPOS_IMG.has(tipo)) return erro(request, 'tipo de imagem não aceito', 415);
  const buf = await request.arrayBuffer();
  if (!buf.byteLength) return erro(request, 'imagem vazia', 400);
  if (buf.byteLength > MAX_IMG) return erro(request, 'imagem grande demais (máximo 8 MB)', 413);
  await env.SERVICOS.put(`img:${ref}`, buf, { metadata: { tipo } });
  return json(request, { ok: true, ref });
}

async function servirImagem(request, env, ref) {
  if (!REF.test(ref)) return new Response('não encontrada', { status: 404 });
  const { value, metadata } = await env.SERVICOS.getWithMetadata(`img:${ref}`, 'arrayBuffer');
  if (!value) return new Response('não encontrada', { status: 404 });
  return new Response(value, {
    headers: { 'Content-Type': metadata?.tipo || 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable', ...corsDe(request) },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const caminho = url.pathname.replace(/\/+$/, '') || '/';
    const m = request.method;

    if (m === 'OPTIONS') return new Response(null, { status: 204, headers: corsDe(request) });

    try {
      // ---------- públicas
      if (caminho === '/api/produtos' && (m === 'GET' || m === 'HEAD')) {
        const c = await lerCatalogo(env);
        return json(request, { produtos: publicos(c, url.origin), atualizado: c.atualizado }, 200, { 'Cache-Control': 'public, max-age=60' });
      }
      const img = caminho.match(/^\/img\/([^/]+)$/);
      if (img && (m === 'GET' || m === 'HEAD')) return servirImagem(request, env, img[1]);
      const lp = caminho.match(/^\/api\/paginas\/([a-z0-9-]+)$/);
      if (lp && (m === 'GET' || m === 'HEAD')) {
        const pg = await paginaPublica(env, lp[1]);
        return pg ? json(request, { pagina: pg }, 200, { 'Cache-Control': 'public, max-age=60' }) : erro(request, 'página não encontrada', 404);
      }

      // ---------- painel
      if (caminho.startsWith('/api/admin/')) {
        if (!autorizado(request, env)) return erro(request, 'senha incorreta', 401);

        if (caminho === '/api/admin/catalogo' && m === 'GET') {
          return json(request, await lerCatalogo(env), 200, { 'Cache-Control': 'no-store' });
        }
        if (caminho === '/api/admin/catalogo' && m === 'PUT') return gravarCatalogo(request, env);
        if (caminho === '/api/admin/servicos-pgt' && m === 'GET') {
          if (!env.UNIVERSO) return erro(request, 'sem a ligação com o Universo', 503);
          try {
            const r = await env.UNIVERSO.fetch('https://universo/api/v1/bases/lista');
            if (!r.ok) return erro(request, `o Universo respondeu ${r.status}`, 502);
            return json(request, await r.json(), 200, { 'Cache-Control': 'no-store' });
          } catch (e) { return erro(request, 'não consegui falar com o Universo', 502); }
        }

        const im = caminho.match(/^\/api\/admin\/imagens\/([^/]+)$/);
        if (im && m === 'PUT') return gravarImagem(request, env, im[1]);

        if (caminho === '/api/admin/versoes' && m === 'GET') {
          const vers = await env.SERVICOS.list({ prefix: 'ver:' });
          const lista = await Promise.all(vers.keys.map(async (k) => {
            const c = await env.SERVICOS.get(k.name, 'json');
            return { chave: k.name, data: k.name.slice(4), versao: c?.versao ?? null, produtos: c?.produtos?.length ?? 0 };
          }));
          return json(request, { versoes: lista.sort((a, b) => b.data.localeCompare(a.data)) });
        }
        if (caminho === '/api/admin/paginas' && m === 'GET') {
          const regs = await todosRegistros(env);
          return json(request, { paginas: regs.map(resumo) }, 200, { 'Cache-Control': 'no-store' });
        }
        const pa = caminho.match(/^\/api\/admin\/paginas\/([a-z0-9-]+)(\/publicar)?$/);
        if (pa) {
          if (!ID_PAGINA.test(pa[1])) return erro(request, 'id inválido', 400);
          if (!pa[2] && m === 'GET') {
            const r = await lerRegistro(env, pa[1]);
            return r ? json(request, { registro: r, resumo: resumo(r) }, 200, { 'Cache-Control': 'no-store' }) : erro(request, 'página não encontrada', 404);
          }
          if (!pa[2] && m === 'PUT') return gravarPagina(request, env, pa[1]);
          if (pa[2] && m === 'POST') return publicarPagina(request, env, pa[1]);
        }
        const pv = caminho.match(/^\/api\/admin\/previa\/([a-z0-9-]+)$/);
        if (pv && m === 'GET') {
          const r = (await todosRegistros(env)).find((x) => x.rascunho.slug === pv[1]);
          return r ? json(request, { pagina: r.rascunho }, 200, { 'Cache-Control': 'no-store' }) : erro(request, 'página não encontrada', 404);
        }
        if (caminho === '/api/admin/versao' && m === 'GET') {
          const chave = url.searchParams.get('chave') || '';
          if (!chave.startsWith('ver:')) return erro(request, 'chave inválida', 400);
          const c = await env.SERVICOS.get(chave, 'json');
          return c ? json(request, c) : erro(request, 'versão não encontrada', 404);
        }
      }

      return erro(request, 'não encontrado', 404);
    } catch (e) {
      return erro(request, 'erro no servidor: ' + (e?.message || e), 500);
    }
  },
};
