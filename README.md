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

## Landing pages em módulos (20/11/2026)

No painel as peças das landing pages se chamam **módulos** (para não confundir com o Bloco da interface do Universo); no código e nos dados ficou `blocos`.

- **Biblioteca de módulos** (`assets/lp/blocos.js` + `assets/lp/blocos.css`): a raiz de todas as páginas. Cada módulo (Abertura, Abertura com serviços, Duas colunas, Antes e depois, Itens numerados, Portfólio, Itens inclusos, Texto e duas imagens, Perguntas frequentes, Autoria, Números, Chamada final) diz os campos, o exemplo e o desenho. Mudou ali, mudaram todas as páginas. Marca: núcleo Arquitetos (papel, areia, véu ardósia, selo Roda), Inter, pontos laterais.
- **Páginas**: cada página guarda só a lista de blocos e os textos (API, KV `pagina:<id>` e `lp:<endereço>`). A casca de cada endereço é um arquivo com `layout: lp` e `pagina: <endereço>` (`/inicio/`, `/residencial/`, `/interiores/`); `assets/lp/pagina.js` monta a página (cópia local → API → reserva de `_data/paginas/<endereço>.json`). Qualquer página publicada abre também em `/lp/?p=<endereço>`; `?previa` mostra o rascunho a quem entrou no painel no mesmo navegador.
- **Painel**: o produto abre numa subpágina (`#/produto/<id>`, abas Ficha | Landing page). Na aba Landing page escolhem-se os módulos da biblioteca (arrastando para ordenar; o + entre dois módulos acrescenta ali) e preenchem-se os campos; Salvar guarda o rascunho, Publicar põe no ar. Página inicial em `#/inicio`; Biblioteca de módulos em `#/modulos`.
- **Endereço próprio para página nova**: com o secret `SERVICOS_GITHUB_TOKEN` (token fino só com Contents: read and write neste repositório), o Worker cria `/<endereço>/index.html` ao publicar. Sem ele, a página fica em `/lp/?p=<endereço>` até a casca ser criada.
