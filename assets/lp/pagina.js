// Odisse · monta uma landing page a partir da biblioteca de blocos (assets/lp/blocos.js).
// A casca de cada página (ex.: /residencial/index.html, layout "lp") diz só o endereço; o conteúdo vem da API
// (servicos-odisse Worker), na ordem: cópia guardada neste navegador (na hora) → API (confere por baixo).
// Sem cópia, espera a API um instante; se ela não responder, usa a reserva gravada na própria casca.
// ?previa mostra o rascunho (só para quem entrou no painel neste navegador).

import { desenharPagina, faqLd, esc } from './blocos.js';

const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const API = LOCAL ? `http://${location.hostname}:8787` : (window.Odisse?.API || 'https://servicos-odisse.reservaprojectbasework.workers.dev');
const raiz = document.getElementById('lp');
const busca = new URLSearchParams(location.search);
const slug = (raiz.dataset.pagina || busca.get('p') || '').toLowerCase();
const previa = busca.has('previa');
const CHAVE = `lp:${slug}`;
let mostrado = '';

const ler = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };

function meta(nome, valor) {
  let m = document.querySelector(`meta[name="${nome}"]`);
  if (!m) { m = document.createElement('meta'); m.name = nome; document.head.appendChild(m); }
  m.content = valor;
}

function mostrar(pagina) {
  if (!pagina || !Array.isArray(pagina.blocos)) return;
  const assinatura = JSON.stringify(pagina);
  if (assinatura === mostrado) return;
  mostrado = assinatura;
  raiz.classList.remove('lp-carregando');
  raiz.innerHTML = (previa ? '<div class="lp-aviso-previa">Prévia do rascunho — ainda não publicado</div>' : '') + desenharPagina(pagina, { api: API });
  if (pagina.titulo) document.title = pagina.titulo;
  if (pagina.descricao) meta('description', pagina.descricao);
  const ld = faqLd(pagina);
  document.getElementById('lp-faq')?.remove();
  if (ld) {
    const s = document.createElement('script');
    s.type = 'application/ld+json'; s.id = 'lp-faq'; s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
  }
  gridServicos();
  pontos.atualizar();
}

// ---------------------------------------------------------------- grid de serviços (bloco Abertura com serviços)
const CHAVE_GRID = 'servicos-grid';
let produtosGrid = ler(CHAVE_GRID);
let gridPedido = false;

function desenharGrid() {
  const el = raiz.querySelector('[data-grid-servicos]');
  if (!el || !produtosGrid?.length) return;
  el.innerHTML = produtosGrid.map((p) => {
    const u = p.imagem?.url || '';
    const alvo = p.externo ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${esc(p.link)}" class="lp-servico${u ? '' : ' sem-imagem'}"${alvo}>
      ${u ? `<div class="lp-servico-fundo" style="background-image:url('${esc(u)}')"></div>` : ''}
      <div class="lp-servico-veu"></div>
      <div class="lp-servico-txt"><h3>${esc(p.titulo)}</h3>${p.texto ? `<p>${esc(p.texto)}</p>` : ''}<span class="lp-servico-cta">${esc(p.chamada)} <span class="seta">→</span></span></div></a>`;
  }).join('');
  el.classList.toggle('muitos', produtosGrid.length > 4);
  el.style.setProperty('--colunas', Math.min(produtosGrid.length, 4));
  pontos.atualizar();
}

function gridServicos() {
  if (!raiz.querySelector('[data-grid-servicos]')) return;
  desenharGrid();
  if (gridPedido) return;
  gridPedido = true;
  fetch(`${API}/api/produtos`)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => {
      if (!Array.isArray(d?.produtos)) return;
      produtosGrid = d.produtos;
      guardar(CHAVE_GRID, produtosGrid);
      desenharGrid();
    })
    .catch(() => { /* fica a última cópia */ });
}

// ---------------------------------------------------------------- pontos laterais (claros sobre imagem ou fundo escuro)
const pontos = (() => {
  let els = [];
  let pendente = false;
  function escuroSob(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.classList?.contains('pontos') || el.classList?.contains('ponto')) continue;
      if (el.tagName === 'IMG' && el.complete && el.naturalWidth) return true;
      const cs = getComputedStyle(el);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && /url\(/.test(cs.backgroundImage)) return true;
      const m = cs.backgroundColor.match(/[\d.]+/g);
      if (!m) continue;
      const v = m.map(Number);
      if (v.length > 3 && v[3] === 0) continue;
      return (0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]) / 255 < 0.5;
    }
    return false;
  }
  function atualizar() {
    if (!els.length) {
      const w = document.createElement('div');
      w.className = 'pontos'; w.setAttribute('aria-hidden', 'true');
      w.innerHTML = ['e1', 'e2', 'e3', 'd1', 'd2', 'd3'].map((p) => `<span class="ponto ${p}"></span>`).join('');
      document.body.appendChild(w);
      els = [...w.children];
      addEventListener('scroll', atualizar, { passive: true });
      addEventListener('resize', atualizar, { passive: true });
    }
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(() => {
      pendente = false;
      for (const p of els) {
        const r = p.getBoundingClientRect();
        p.classList.toggle('claro', escuroSob(r.left + r.width / 2, r.top + r.height / 2));
      }
    });
  }
  return { atualizar };
})();

// ---------------------------------------------------------------- carga

function reserva() {
  try { return JSON.parse(document.getElementById('lp-reserva')?.textContent || 'null'); } catch { return null; }
}

async function daApi() {
  if (previa) {
    const senha = ler('servicos-painel-senha');
    const r = await fetch(`${API}/api/admin/previa/${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${senha || ''}` }, cache: 'no-store' });
    if (!r.ok) throw new Error(r.status === 401 ? 'Entre no painel neste navegador para ver a prévia.' : `erro ${r.status}`);
    return (await r.json()).pagina;
  }
  const r = await fetch(`${API}/api/paginas/${encodeURIComponent(slug)}`);
  if (!r.ok) throw new Error(`erro ${r.status}`);
  return (await r.json()).pagina;
}

(async function iniciar() {
  if (!slug) { raiz.innerHTML = '<p style="padding:48px">Página não informada.</p>'; return; }
  if (!previa) mostrar(ler(CHAVE));
  const pedido = daApi();
  if (!mostrado) {
    const espera = new Promise((ok) => setTimeout(ok, 1500));
    await Promise.race([pedido.catch(() => {}), espera]);
  }
  try {
    const p = await pedido;
    if (!previa) guardar(CHAVE, p);
    mostrar(p);
  } catch (e) {
    if (previa) { raiz.innerHTML = `<p style="padding:48px;font:15px/1.5 Inter,sans-serif">${esc(e.message)}</p>`; return; }
    if (!mostrado) mostrar(reserva());
    if (!mostrado) raiz.innerHTML = '<p style="padding:48px">Não consegui carregar esta página. Tente de novo em instantes.</p>';
  }
})();
