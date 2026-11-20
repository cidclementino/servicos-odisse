// Painel do servicos.odisse.com.br — Catálogo de serviços e produtos do Odisse.
// Lê e grava o catálogo inteiro na API (worker/), com a versão para não sobrescrever mudança feita em outro lugar.
// Abre com a última cópia guardada neste navegador e confere a nuvem por baixo.

const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const API = LOCAL ? `http://${location.hostname}:8787` : (window.Odisse?.API || 'https://servicos-odisse.reservaprojectbasework.workers.dev');
const CHAVE_SENHA = 'servicos-painel-senha';
const CHAVE_COPIA = 'servicos-painel-catalogo';
const CHAVE_FILTROS = 'servicos-painel-filtros';
const CHAVE_BLOCOS = 'servicos-painel-blocos';

const TRILHOS = [
  ['cliente', 'Cliente final', 'Cliente'],
  ['corretores', 'Corretores', 'Corretores'],
  ['construtoras', 'Construtoras e incorporadoras', 'Construtoras'],
  ['escritorios', 'Escritórios', 'Escritórios'],
];
const DEGRAUS = [['entrada', 'Entrada (grátis)', 'pessego'], ['leve', 'Pago leve', 'areia'], ['contrato', 'Contrato', '']];
const SITUACOES = [
  ['no-ar', 'No ar', 'ok'],
  ['desenvolvimento', 'Em desenvolvimento', 'atencao'],
  ['a-desenvolver', 'A desenvolver', 'tracejada'],
  ['pausado', 'Pausado', ''],
  ['arquivado', 'Arquivado', ''],
];
const nomeDe = (lista, id) => (lista.find((x) => x[0] === id) || [id, id])[1];

// ícones SVG (design.md: nunca caracteres de texto)
const IC = {
  cima: '<svg class="ic" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5 7 5l3.5 3.5"/></svg>',
  baixo: '<svg class="ic" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 5.5 7 9l3.5-3.5"/></svg>',
  fechar: '<svg class="ic" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg>',
};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ler = (k, padrao) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch { return padrao; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };

let senha = '';
let catalogo = null;           // { versao, atualizado, produtos }
let filtros = { situacao: 'todos', trilho: 'todos', busca: '', ...ler(CHAVE_FILTROS, {}) };
filtros.busca = '';
let aberto = null;             // { original, rascunho, novo }
let gravando = false;

// ---------------------------------------------------------------- API

async function api(caminho, opcoes = {}) {
  const r = await fetch(API + caminho, {
    ...opcoes,
    headers: { Authorization: `Bearer ${senha}`, ...(opcoes.body && !(opcoes.body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...(opcoes.headers || {}) },
  });
  let dados = null;
  try { dados = await r.json(); } catch { /* sem corpo */ }
  if (!r.ok) {
    const e = new Error(dados?.error || `erro ${r.status}`);
    e.status = r.status; e.dados = dados;
    throw e;
  }
  return dados;
}

async function gravar(produtos, mensagemOk) {
  if (gravando) return false;
  gravando = true;
  try {
    const novo = await api('/api/admin/catalogo', { method: 'PUT', body: JSON.stringify({ versao: catalogo.versao, produtos }) });
    catalogo = novo;
    guardar(CHAVE_COPIA, catalogo);
    desenhar();
    if (mensagemOk) avisar(mensagemOk, 'ok');
    return true;
  } catch (e) {
    if (e.status === 409 && e.dados?.catalogo) {
      catalogo = e.dados.catalogo;
      guardar(CHAVE_COPIA, catalogo);
      desenhar();
      avisar('O catálogo foi mudado em outro lugar. A lista foi recarregada: confira e faça a mudança de novo.', 'erro');
    } else if (e.status === 401) {
      sair('A senha não vale mais. Entre de novo.');
    } else {
      avisar('Não consegui gravar: ' + e.message, 'erro');
    }
    return false;
  } finally {
    gravando = false;
  }
}

// ---------------------------------------------------------------- entrada

function mostrarEntrada(msg) {
  document.body.classList.add('vista-login');
  $('#entrada').hidden = false;
  $('#pagina').hidden = true;
  const er = $('#erroEntrada');
  er.hidden = !msg; er.textContent = msg || '';
  setTimeout(() => $('#senha').focus(), 0);
}

function mostrarPagina() {
  document.body.classList.remove('vista-login');
  $('#entrada').hidden = true;
  $('#pagina').hidden = false;
}

function sair(msg) {
  senha = '';
  try { localStorage.removeItem(CHAVE_SENHA); } catch { /* */ }
  fecharGaveta(true);
  mostrarEntrada(msg);
}

async function entrar(s, silencioso) {
  senha = s;
  const copia = ler(CHAVE_COPIA, null);
  if (silencioso && copia) { catalogo = copia; mostrarPagina(); desenhar(); }
  try {
    catalogo = await api('/api/admin/catalogo');
    guardar(CHAVE_SENHA, s);
    guardar(CHAVE_COPIA, catalogo);
    mostrarPagina();
    desenhar();
  } catch (e) {
    if (e.status === 401) return sair(silencioso ? '' : 'Senha incorreta.');
    if (catalogo) avisar('Sem conexão com a API: mostrando a última cópia deste computador.', 'erro');
    else mostrarEntrada('Não consegui falar com a API: ' + e.message);
  }
}

// ---------------------------------------------------------------- lista

function situacaoEtq(id) {
  const s = SITUACOES.find((x) => x[0] === id) || [id, id, ''];
  return `<span class="etq ${s[2]}">${esc(s[1])}</span>`;
}
function degrauEtq(id) {
  const d = DEGRAUS.find((x) => x[0] === id) || [id, id, ''];
  return `<span class="etq ${d[2]}">${esc(d[1])}</span>`;
}
function noSiteEtq(p) {
  if (!p.noSite) return '<span class="etq">fora do grid</span>';
  if (p.situacao !== 'no-ar') return '<span class="etq tracejada">quando no ar</span>';
  if (!p.publico.titulo || !p.publico.link) return '<span class="etq problema">falta título ou link</span>';
  return '<span class="etq ok">no grid</span>';
}

function visiveis() {
  const b = semAcento(filtros.busca);
  return catalogo.produtos.filter((p) => {
    if (filtros.situacao === 'todos' ? p.situacao === 'arquivado' : p.situacao !== filtros.situacao) return false;
    if (filtros.trilho !== 'todos' && p.trilho !== filtros.trilho) return false;
    if (b && !semAcento(`${p.nome} ${p.publico.titulo} ${p.publico.texto} ${p.notas}`).includes(b)) return false;
    return true;
  });
}

function desenharSeletores() {
  const conta = (f) => catalogo.produtos.filter(f).length;
  const sit = [['todos', 'Todos', conta((p) => p.situacao !== 'arquivado')],
    ...SITUACOES.map(([id, nome]) => [id, id === 'arquivado' ? 'Arquivados' : id === 'pausado' ? 'Pausados' : nome, conta((p) => p.situacao === id)])];
  $('#selSituacao').innerHTML = sit.map(([id, nome, n]) =>
    `<button type="button" role="radio" data-v="${id}" aria-checked="${filtros.situacao === id}">${esc(nome)} <span class="n">${n}</span></button>`).join('');
  const tri = [['todos', 'Todos os trilhos'], ...TRILHOS.map(([id, , curto]) => [id, curto])];
  $('#selTrilho').innerHTML = tri.map(([id, nome]) =>
    `<button type="button" role="radio" data-v="${id}" aria-checked="${filtros.trilho === id}">${esc(nome)}</button>`).join('');
  $('#btLimpar').hidden = filtros.situacao === 'todos' && filtros.trilho === 'todos' && !filtros.busca;
}

function desenharLista() {
  const lista = visiveis();
  if (!lista.length) {
    $('#lista').innerHTML = '<div class="vazio">Nenhum produto com estes filtros.</div>';
    return;
  }
  $('#lista').innerHTML = lista.map((p) => {
    const i = lista.indexOf(p);
    const sub = p.publico.titulo && p.publico.texto ? `${p.publico.titulo} · ${p.publico.texto}` : (p.publico.texto || p.publico.titulo || p.notas || '');
    const classe = p.situacao === 'a-desenvolver' ? ' tracejada' : p.situacao === 'arquivado' ? ' arquivada' : '';
    return `<div class="linha${classe}" role="button" tabindex="0" data-id="${esc(p.id)}">
      <div class="linha-nome"><b>${esc(p.nome)}</b><small>${esc(sub) || '<span class="sem">—</span>'}</small></div>
      <div class="linha-etqs">
        <span class="col"><span class="etq">${esc(nomeDe(TRILHOS, p.trilho))}</span></span>
        <span class="col">${degrauEtq(p.degrau)}</span>
        <span class="col">${situacaoEtq(p.situacao)}</span>
        <span class="col">${noSiteEtq(p)}</span>
      </div>
      <div class="linha-cmd">
        <button class="caixa" type="button" data-mover="-1" aria-label="Subir ${esc(p.nome)}" title="Subir" ${i === 0 ? 'disabled' : ''}>${IC.cima}</button>
        <button class="caixa" type="button" data-mover="1" aria-label="Descer ${esc(p.nome)}" title="Descer" ${i === lista.length - 1 ? 'disabled' : ''}>${IC.baixo}</button>
      </div>
    </div>`;
  }).join('');
}

function cartaoSite(pub, classeExtra = '') {
  const im = pub.imagem;
  const url = im?.ref ? `${API}/img/${im.ref}` : im?.caminho || im?.dataUrl || '';
  return `<div class="cartao-site${url ? '' : ' sem-img'}${classeExtra}">
    ${url ? `<div class="bg" style="background-image:url('${esc(url)}')"></div>` : ''}
    <div class="veu"></div>
    <div class="txt"><h4>${esc(pub.titulo || 'Sem título')}</h4>${pub.texto ? `<p>${esc(pub.texto)}</p>` : ''}<span>${esc(pub.chamada || 'Saiba mais')} →</span></div>
  </div>`;
}

function desenharGrid() {
  const noGrid = catalogo.produtos.filter((p) => p.situacao === 'no-ar' && p.noSite && p.publico.titulo && p.publico.link);
  $('#gridPrevia').innerHTML = noGrid.length
    ? noGrid.map((p) => cartaoSite(p.publico)).join('')
    : '<div class="vazio">Nenhum produto no ar marcado para o site.</div>';
}

function desenhar() {
  if (!catalogo) return;
  desenharSeletores();
  desenharLista();
  desenharGrid();
  const d = catalogo.atualizado ? new Date(catalogo.atualizado) : null;
  $('#atualizado').textContent = d ? `Atualizado em ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Catálogo inicial, ainda não gravado';
}

let avisoTimer;
function avisar(msg, tipo = '') {
  const a = $('#avisoGeral');
  a.className = `aviso ${tipo}`;
  a.textContent = msg;
  a.hidden = false;
  clearTimeout(avisoTimer);
  if (tipo === 'ok') avisoTimer = setTimeout(() => { a.hidden = true; }, 3500);
}

// mover dentro da lista visível: troca de lugar com o vizinho visível no catálogo inteiro
async function mover(id, passo) {
  const lista = visiveis();
  const i = lista.findIndex((p) => p.id === id);
  const vizinho = lista[i + passo];
  if (!vizinho) return;
  const produtos = catalogo.produtos.slice();
  const a = produtos.findIndex((p) => p.id === id);
  const b = produtos.findIndex((p) => p.id === vizinho.id);
  [produtos[a], produtos[b]] = [produtos[b], produtos[a]];
  await gravar(produtos);
  document.querySelector(`.linha[data-id="${CSS.escape(id)}"] [data-mover="${passo}"]`)?.focus();
}

// ---------------------------------------------------------------- gaveta

const blocosFechados = ler(CHAVE_BLOCOS, {});
const vazio = () => ({ id: '', nome: '', trilho: filtros.trilho !== 'todos' ? filtros.trilho : 'cliente', degrau: 'contrato', situacao: 'a-desenvolver', noSite: true,
  publico: { titulo: '', texto: '', chamada: '', link: '', imagem: null }, notas: '' });
const copiar = (p) => JSON.parse(JSON.stringify(p));
const slug = (s) => semAcento(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

function bloco(id, titulo, corpo) {
  const fechado = blocosFechados[id] ? ' fechado' : '';
  return `<section class="bloco${fechado}" data-bloco="${id}">
    <button type="button" class="bloco-cab" aria-expanded="${!fechado}"><h3>${esc(titulo)}</h3><span class="caixa" aria-hidden="true">${IC.baixo}</span></button>
    <div class="bloco-corpo">${corpo}</div>
  </section>`;
}

function campoTexto(nome, rotulo, valor, { max, dica, area, tipo = 'text', lista } = {}) {
  const conta = max ? `<span class="conta" data-conta="${nome}">${(valor || '').length} / ${max}</span>` : '';
  const ctl = area
    ? `<textarea name="${nome}" rows="${area}" ${max ? `maxlength="${max}"` : ''}>${esc(valor)}</textarea>`
    : `<input type="${tipo}" name="${nome}" value="${esc(valor)}" ${max ? `maxlength="${max}"` : ''} ${lista ? `list="${lista}"` : ''}>`;
  return `<label class="u-campo"><span>${esc(rotulo)}${conta}</span>${ctl}${dica ? `<small>${esc(dica)}</small>` : ''}</label>`;
}

function seletorCampo(nome, opcoes, valor) {
  return `<div class="seletor pequeno" role="radiogroup" data-campo="${nome}">${opcoes.map(([id, rotulo]) =>
    `<button type="button" role="radio" data-v="${id}" aria-checked="${valor === id}">${esc(rotulo)}</button>`).join('')}</div>`;
}

function desenharGaveta() {
  const p = aberto.rascunho;
  $('#gavRotulo').textContent = aberto.novo ? 'Novo produto' : 'Produto';
  $('#gavTitulo').textContent = p.nome || 'Sem nome';
  const im = p.publico.imagem;
  const imgUrl = im?.ref ? `${API}/img/${im.ref}` : im?.caminho || im?.dataUrl || '';

  const situacao = `
    ${campoTexto('nome', 'Nome interno', p.nome, { max: 120 })}
    <div class="grupo-campo"><span class="rotulo-campo">Situação</span>${seletorCampo('situacao', SITUACOES.map(([id, n]) => [id, n]), p.situacao)}</div>
    <div class="duas">
      <label class="u-campo"><span>Trilho</span><select name="trilho">${TRILHOS.map(([id, n]) => `<option value="${id}" ${p.trilho === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label class="u-campo"><span>Degrau</span><select name="degrau">${DEGRAUS.map(([id, n]) => `<option value="${id}" ${p.degrau === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    </div>
    <label class="chave"><input type="checkbox" name="noSite" ${p.noSite ? 'checked' : ''}> Aparece no grid do site quando estiver no ar</label>
    ${aberto.novo ? '' : `<div class="dica" style="margin-top:12px">Código <span class="etq codigo">${esc(p.id)}</span></div>`}`;

  const site = `
    ${campoTexto('titulo', 'Título no cartão', p.publico.titulo, { max: 120 })}
    ${campoTexto('texto', 'Texto', p.publico.texto, { max: 240, area: 3 })}
    <div class="duas">
      ${campoTexto('chamada', 'Chamada', p.publico.chamada, { max: 40, dica: 'Ex.: Ver projeto, Fazer meu plano' })}
      ${campoTexto('link', 'Link', p.publico.link, { dica: 'Página do servicos (/residencial/) ou endereço completo' })}
    </div>
    <div class="grupo-campo"><span class="rotulo-campo">Imagem de capa</span>
      <div class="imagem-campo">
        <div class="imagem-mini${imgUrl ? '' : ' vazia'}" ${imgUrl ? `style="background-image:url('${esc(imgUrl)}')"` : ''}>${imgUrl ? '' : 'sem imagem'}</div>
        <div class="imagem-acoes">
          <button type="button" class="u-botao" data-acao="imagem">${imgUrl ? 'Trocar imagem' : 'Enviar imagem'}</button>
          ${imgUrl ? '<button type="button" class="u-botao perigo" data-acao="tirar-imagem">Tirar imagem</button>' : ''}
          <small class="dica">Vertical, 4:5. Convertida para WebP aqui no navegador.</small>
        </div>
      </div>
      <input type="file" accept="image/*" id="arqImagem" hidden>
    </div>
    <div class="u-rotulo previa-rotulo">Como sai no site</div>
    <div class="previa-gav">${cartaoSite(p.publico)}</div>`;

  const notas = campoTexto('notas', 'O que falta, decisões, dependências', p.notas, { area: 6, max: 4000 });

  $('#gavForm').innerHTML = bloco('situacao', 'Situação', situacao) + bloco('site', 'No site', site) + bloco('notas', 'Notas internas', notas)
    + (aberto.novo || p.situacao === 'arquivado' ? '' : '<div class="gav-rodape"><button type="button" class="u-botao perigo" data-acao="arquivar">Arquivar produto</button></div>');
  marcarMudanca();
}

function mudou() {
  if (!aberto) return false;
  const { imagem: a, ...ra } = aberto.rascunho.publico;
  const { imagem: b, ...rb } = aberto.original.publico;
  return aberto.novo || aberto.arquivo
    || JSON.stringify({ ...aberto.rascunho, publico: ra }) !== JSON.stringify({ ...aberto.original, publico: rb })
    || JSON.stringify(a) !== JSON.stringify(b);
}

function marcarMudanca() {
  const m = mudou();
  $('#barraSalvar').hidden = !m;
  $('#barraTexto').textContent = aberto?.novo ? 'Produto novo, ainda não salvo' : 'Mudanças não salvas';
}

function abrirGaveta(id) {
  const p = id ? catalogo.produtos.find((x) => x.id === id) : vazio();
  if (!p) return;
  aberto = { original: copiar(p), rascunho: copiar(p), novo: !id, arquivo: null, origem: document.activeElement };
  desenharGaveta();
  $('#gavetaFundo').hidden = false;
  $('#gaveta').hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => (aberto.novo ? $('#gavForm [name="nome"]') : $('#gavFechar')).focus(), 0);
}

function fecharGaveta(forcar) {
  if (!aberto) return;
  if (!forcar && mudou() && !confirm('Descartar as mudanças deste produto?')) return;
  const origem = aberto.origem;
  aberto = null;
  $('#gavetaFundo').hidden = true;
  $('#gaveta').hidden = true;
  $('#barraSalvar').hidden = true;
  document.body.style.overflow = '';
  origem?.focus?.();
}

async function salvarGaveta() {
  const p = aberto.rascunho;
  p.nome = p.nome.trim();
  if (!p.nome) { avisarGaveta('Dê um nome ao produto.'); $('#gavForm [name="nome"]').focus(); return; }
  if (p.situacao === 'no-ar' && p.noSite && (!p.publico.titulo.trim() || !p.publico.link.trim())) {
    if (!confirm('No ar e marcado para o site, mas sem título ou link: não vai aparecer no grid. Salvar assim mesmo?')) return;
  }
  const btn = $('#btSalvar');
  btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (aberto.novo) {
      let base = slug(p.nome) || 'produto', id = base, n = 2;
      while (catalogo.produtos.some((x) => x.id === id)) id = `${base}-${n++}`;
      p.id = id;
    }
    if (aberto.arquivo) {
      const { reduzir } = await import('https://universo.odisse.com.br/base/v1/imagens.js');
      const bmp = await createImageBitmap(aberto.arquivo, { imageOrientation: 'from-image' });
      const m = await reduzir(bmp, 1600);
      bmp.close?.();
      const ref = `${p.id}-${Date.now().toString(36)}`;
      await api(`/api/admin/imagens/${ref}`, { method: 'PUT', body: m.blob, headers: { 'Content-Type': m.blob.type } });
      p.publico.imagem = { ref, w: m.w, h: m.h };
    }
    const limpo = copiar(p);
    if (limpo.publico.imagem?.dataUrl) limpo.publico.imagem = null;
    const produtos = aberto.novo ? [...catalogo.produtos, limpo] : catalogo.produtos.map((x) => (x.id === p.id ? limpo : x));
    const ok = await gravar(produtos, aberto.novo ? `“${p.nome}” entrou no catálogo.` : `“${p.nome}” salvo.`);
    if (ok) fecharGaveta(true);
  } catch (e) {
    avisarGaveta('Não consegui salvar: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Salvar';
  }
}

function avisarGaveta(msg) {
  let a = $('#gavForm .aviso');
  if (!a) { a = document.createElement('div'); $('#gavForm').prepend(a); }
  a.className = 'aviso erro';
  a.textContent = msg;
}

// ---------------------------------------------------------------- eventos

function ligar() {
  $('#formEntrada').addEventListener('submit', (e) => { e.preventDefault(); entrar($('#senha').value, false); });
  $('#btSair').addEventListener('click', () => sair());

  $('#selSituacao').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    filtros.situacao = b.dataset.v; guardar(CHAVE_FILTROS, { situacao: filtros.situacao, trilho: filtros.trilho }); desenhar();
  });
  $('#selTrilho').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    filtros.trilho = b.dataset.v; guardar(CHAVE_FILTROS, { situacao: filtros.situacao, trilho: filtros.trilho }); desenhar();
  });
  $('#busca').addEventListener('input', (e) => { filtros.busca = e.target.value; desenharSeletores(); desenharLista(); });
  $('#btLimpar').addEventListener('click', () => {
    filtros = { situacao: 'todos', trilho: 'todos', busca: '' }; $('#busca').value = ''; guardar(CHAVE_FILTROS, filtros); desenhar();
  });

  $('#btNovo').addEventListener('click', () => abrirGaveta(null));

  $('#lista').addEventListener('click', (e) => {
    const mv = e.target.closest('[data-mover]');
    const linha = e.target.closest('.linha');
    if (!linha) return;
    if (mv) { e.stopPropagation(); mover(linha.dataset.id, Number(mv.dataset.mover)); return; }
    if (getSelection().toString()) return;
    abrirGaveta(linha.dataset.id);
  });
  $('#lista').addEventListener('keydown', (e) => {
    const linha = e.target.closest('.linha');
    if (linha && e.target === linha && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirGaveta(linha.dataset.id); }
  });

  // gaveta
  $('#gavFechar').innerHTML = IC.fechar;
  $('#gavFechar').addEventListener('click', () => fecharGaveta());
  $('#gavetaFundo').addEventListener('click', () => fecharGaveta());
  $('#btDescartar').addEventListener('click', () => {
    if (aberto.novo) return fecharGaveta(true);
    aberto.rascunho = copiar(aberto.original); aberto.arquivo = null; desenharGaveta();
  });
  $('#btSalvar').addEventListener('click', salvarGaveta);
  document.addEventListener('keydown', (e) => {
    if (!aberto) return;
    if (e.key === 'Escape') { e.preventDefault(); fecharGaveta(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (mudou()) salvarGaveta(); }
  });

  const form = $('#gavForm');
  const PUB = new Set(['titulo', 'texto', 'chamada', 'link']);
  form.addEventListener('input', (e) => {
    const el = e.target; if (!el.name || !aberto) return;
    const p = aberto.rascunho;
    if (el.name === 'noSite') p.noSite = el.checked;
    else if (PUB.has(el.name)) p.publico[el.name] = el.value;
    else p[el.name] = el.value;
    if (el.name === 'nome') $('#gavTitulo').textContent = el.value || 'Sem nome';
    const conta = form.querySelector(`[data-conta="${el.name}"]`);
    if (conta && el.maxLength > 0) { conta.textContent = `${el.value.length} / ${el.maxLength}`; conta.classList.toggle('passou', el.value.length >= el.maxLength); }
    if (PUB.has(el.name)) form.querySelector('.previa-gav').innerHTML = cartaoSite(p.publico);
    marcarMudanca();
  });
  form.addEventListener('click', (e) => {
    const cab = e.target.closest('.bloco-cab');
    if (cab) {
      const b = cab.closest('.bloco'); b.classList.toggle('fechado');
      cab.setAttribute('aria-expanded', !b.classList.contains('fechado'));
      blocosFechados[b.dataset.bloco] = b.classList.contains('fechado'); guardar(CHAVE_BLOCOS, blocosFechados);
      return;
    }
    const sel = e.target.closest('.seletor[data-campo] button[data-v]');
    if (sel) {
      aberto.rascunho[sel.parentElement.dataset.campo] = sel.dataset.v;
      sel.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', b === sel));
      marcarMudanca();
      return;
    }
    const acao = e.target.closest('[data-acao]')?.dataset.acao;
    if (acao === 'imagem') $('#arqImagem').click();
    if (acao === 'tirar-imagem') { aberto.rascunho.publico.imagem = null; aberto.arquivo = null; desenharGaveta(); }
    if (acao === 'arquivar') {
      aberto.rascunho.situacao = 'arquivado';
      salvarGaveta();
    }
  });
  form.addEventListener('change', async (e) => {
    if (e.target.id !== 'arqImagem') return;
    const arq = e.target.files?.[0]; if (!arq) return;
    aberto.arquivo = arq;
    const dataUrl = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(arq); });
    aberto.rascunho.publico.imagem = { dataUrl };
    desenharGaveta();
  });

  window.addEventListener('beforeunload', (e) => { if (mudou()) { e.preventDefault(); e.returnValue = ''; } });
}

ligar();
const guardada = ler(CHAVE_SENHA, '');
if (guardada) entrar(guardada, true);
else mostrarEntrada();
