// Grid de serviços da /inicio/: lê o catálogo do painel (servicos.odisse.com.br/painel/) pela API
// e redesenha os cartões com os produtos no ar e marcados para o site, na ordem do catálogo.
// Abre com a última cópia guardada neste navegador; se a API não responder, ficam os cartões do próprio HTML.
(function () {
  var grid = document.getElementById('gridServicos');
  if (!grid) return;
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var API = LOCAL ? 'http://' + location.hostname + ':8787' : ((window.Odisse && window.Odisse.API) || 'https://servicos-odisse.reservaprojectbasework.workers.dev');
  var CHAVE = 'servicos-grid';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function desenhar(produtos) {
    if (!produtos || !produtos.length) return;
    grid.innerHTML = produtos.map(function (p) {
      var img = p.imagem && p.imagem.url;
      var alvo = p.externo ? ' target="_blank" rel="noopener"' : '';
      return '<a href="' + esc(p.link) + '" class="hub-card' + (img ? '' : ' sem-imagem') + '" data-servico="' + esc(p.id) + '"' + alvo + '>' +
        (img ? '<div class="hub-card-bg" style="background-image:url(\'' + esc(img) + '\');"></div>' : '') +
        '<div class="hub-card-overlay"></div>' +
        '<div class="hub-card-content"><h3>' + esc(p.titulo) + '</h3>' + (p.texto ? '<p>' + esc(p.texto) + '</p>' : '') +
        '<span class="hub-card-cta">' + esc(p.chamada) + ' <span class="arrow">→</span></span></div></a>';
    }).join('');
    grid.classList.toggle('muitos', produtos.length > 4);
    grid.style.setProperty('--colunas', Math.min(produtos.length, 4));
  }

  try { desenhar(JSON.parse(localStorage.getItem(CHAVE) || 'null')); } catch (e) { /* sem cópia */ }

  fetch(API + '/api/produtos')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      if (!d || !Array.isArray(d.produtos) || !d.produtos.length) return;
      try { localStorage.setItem(CHAVE, JSON.stringify(d.produtos)); } catch (e) { /* */ }
      desenhar(d.produtos);
    })
    .catch(function () { /* fica o que já está na página */ });
})();
