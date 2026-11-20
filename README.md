# servicos-odisse
LPs do Odisse

Landing pages dos serviços do Odisse, em https://servicos.odisse.com.br (GitHub Pages).

Até 11/11/2026 este repositório se chamava `projetos-odisse` e as páginas ficavam em
projetos.odisse.com.br. Esse endereço passou a ser da ferramenta Projetos do Universo
(repo `projetos-odisse`, novo), que mantém páginas de redirecionamento nos caminhos antigos
(`/inicio/`, `/residencial/`, `/interiores/`, `/formulario-residencial/`, `/formulario-interiores/`)
levando para cá com os parâmetros dos anúncios (`gclid`, `utm_*`) preservados.

## Catálogo de serviços (painel oculto)

- **Painel:** `servicos.odisse.com.br/painel/` (senha `SERVICOS_SENHA`, sem índice nos buscadores). Lista todos os serviços e produtos do Odisse — no ar, em desenvolvimento, a desenvolver, pausados, arquivados —, com trilho (cliente final, corretores, construtoras e incorporadoras, escritórios) e degrau (entrada, pago leve, contrato).
- **Grid da /inicio/:** mostra os produtos **no ar** e marcados para o site, na ordem do catálogo (`assets/servicos.js`). Se a API não responder, ficam os cartões do `_data/inicio_conteudo.yml`.
- **API:** Worker `servicos-odisse` (`worker/`, KV `SERVICOS_ODISSE`), publicado pelo workflow "Publicar API" a cada mudança em `worker/`. Secrets do repositório: `CLOUDFLARE_API_TOKEN` (token `odisse-servicos`, Workers + KV), `CLOUDFLARE_ACCOUNT_ID`, `SERVICOS_SENHA`.
