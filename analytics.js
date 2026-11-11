// analytics.js — Tags do Google (Analytics + Ads) para o Odisse
// Editar apenas aqui quando precisar trocar/adicionar IDs de rastreamento ou eventos de conversão.
// Este arquivo é referenciado por todas as LPs do site — nunca precisa duplicar o código.

window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
gtag('js', new Date());

gtag('config', 'G-7LPHDFTZ5T');       // Google Analytics (GA4)
gtag('config', 'AW-18312358206');     // Google Ads (conta)

// Conversão "Clique WhatsApp - Projetos Odisse" (ação de clique criada no Google Ads
// por reservaprojectbasework@gmail.com) — dispara em qualquer botão/link de WhatsApp
// da página, que é a ação real de lead nesta LP.
document.addEventListener('DOMContentLoaded', function () {
  // Texto pronto do WhatsApp com o código da página (ex.: "[LP-residencial]"): o funil do
  // vendas.odisse reconhece o código ao registrar o lead e preenche a origem sozinho.
  var pagina = (location.pathname.split('/').filter(Boolean)[0] || 'inicio').toLowerCase();
  document.querySelectorAll('a[href*="wa.me"]').forEach(function (link) {
    if (link.href.indexOf('text=') === -1) {
      var texto = 'Olá! Vim pelo site do Odisse e quero conversar sobre um projeto. [LP-' + pagina + ']';
      link.href = link.href + (link.href.indexOf('?') === -1 ? '?' : '&') + 'text=' + encodeURIComponent(texto);
    }
  });
  document.querySelectorAll('a[href*="wa.me"]').forEach(function (link) {
    link.addEventListener('click', function () {
      gtag('event', 'conversion', {
        'send_to': 'AW-18312358206/pYbhCIyTuc4cEL7SgZxE'
      });
    });
  });
});
