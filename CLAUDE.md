# Instruções para o Claude: repositório de propostas da Isla

Este repositório publica propostas comerciais da Isla como páginas web na Vercel.
Cada pasta `site/<slug>/index.html` vira `proposta.<dominio-da-isla>/<slug>`.

## Visual
Toda proposta segue o design system da Isla em `docs/design-system.md` (escuro, monocromático, Instrument Serif + Inter Tight, granulação, vidro escuro, movimento lento). O `modelo/proposta.html` já implementa esse padrão: reaproveite as classes dele. Diferença em relação à landing: o texto das propostas é em português.

## Ao criar uma proposta nova
1. Escolha um slug em minúsculas, com hífens (ex: `padaria-do-ze`). Se não for informado, derive do nome do cliente.
2. Rode `./scripts/nova-proposta.sh <slug> "<Nome do cliente>"` para partir do modelo,
   ou `./scripts/nova-proposta.sh <slug> "<Nome>" <arquivo.html>` se recebeu um HTML pronto (ex: export do Claude Design).
3. Edite `site/<slug>/index.html` com o conteúdo da proposta. Mantenha:
   - a página **autocontida** (CSS e JS no próprio arquivo; imagens e vídeos dentro de `site/<slug>/`);
   - a meta tag `noindex`;
   - o botão "Baixar PDF" e os estilos de `@media print`;
   - o script do Vercel Analytics no fim do `<body>`.
4. Textos em português do Brasil. Nunca invente preços, prazos ou números: use o que foi informado ou deixe um marcador claro como `R$ [VALOR]`.
5. Faça commit (`Proposta: <Cliente>`) e push na `main`. A Vercel publica sozinha.
6. Responda com o link final: `https://proposta.<dominio-da-isla>/<slug>`.

## Decks do Claude Design (`.dc.html`)
Apresentações em slides vindas do Claude Design são publicadas como estão (visual e fontes do próprio deck, formato 1920×1080), sem adaptar ao `modelo/proposta.html`.
1. O projeto exportado é uma pasta com `<Nome>.dc.html`, `support.js`, `deck-stage.js`, `image-slot.js`, `assets/` e às vezes `figma/`. Os do usuário ficam em `~/Documents/ISLA/Clientes/<Cliente>/` (procure com `mdfind -name isla-export.json`). Anexos no chat chegam só como texto, sem imagens: peça a pasta. O prompt que o usuário cola no Claude Design para preparar a exportação está em `docs/prompt-exportar-claude-design.md`.
2. Com `isla-export.json` na pasta: `python3 scripts/importar-deck.py <pasta>` importa todas as propostas listadas (pula `"tipo": "modelo"` e slugs que já existem; `--atualizar` substitui). Sem manifesto: `python3 scripts/importar-deck.py <pasta> "<Nome>.dc.html" <slug> "<título>"`.
   O script copia só o necessário, transforma imagens do `.image-slots.state.json` em arquivos, troca caminhos relativos por `/<slug>/...` (a Vercel serve `/<slug>` sem barra final, então caminho relativo quebra) e aplica os controles da Isla: setas de navegação, "Baixar PDF", barra de miniaturas e barrinha nativa do deck escondidas, noindex e Analytics. Para reaplicar só os controles numa página já publicada: `--controles site/<slug>`.
3. `<image-slot>` vazio no deck aparece como placeholder (o script avisa): preencha com `src="/<slug>/assets/..."` se houver a imagem no projeto.
4. Confira servindo `site/` localmente (`python3 -m http.server`) em 1600×900 e 380px antes do push.

## Painel (página inicial)
`site/index.html` é o painel com todas as apresentações, protegido pelo `middleware.js` com login próprio (`site/login.html`, POST em `/login`, cookie assinado de 30 dias, `/sair` desloga). Só `/` e `/_painel/*` exigem login; as propostas continuam abertas. Ele é **gerado**: não edite à mão.
- Depois de criar ou mudar uma proposta, rode `node scripts/gerar-painel.mjs` (os scripts de importação já rodam) e inclua `site/index.html` e `site/_painel/` no commit.
- Acessos: variável `PAINEL_ACESSOS` na Vercel (produção), formato `email:senha,email2:senha2`, e `PAINEL_SEGREDO` (chave das sessões). Mudar exige um novo deploy (push ou `vercel --prod`). Nunca coloque senhas no repositório.

## Envio pelo painel (Supabase)
O time também publica sem passar pelo chat: botão **Adicionar apresentação** no painel (zip do Claude Design, deck em arquivo único ou pasta com `index.html`) e, em cada card, **Versões** (enviar nova versão, ver, publicar, excluir).
- Os arquivos ficam no Supabase (projeto `isla-propostas`, ref `zrqeupjcmzzaaghvfdja`, plano gratuito, São Paulo). Bucket público `apresentacoes/<slug>/<versão>/`; bucket privado `painel/indice.json` com as versões e qual está no ar. Os buckets são criados sozinhos no primeiro envio.
- O `middleware.js` atende `/<slug>`: se o índice tem versão no ar, serve do Supabase (com os controles de `lib/controles.js`); senão, segue para `site/<slug>/` (a versão "Original"). `?v=<versão>` é só para quem está logado.
- O zip é aberto no navegador (`site/_painel/zip.js`) e os arquivos vão direto para o Supabase por URL assinada (`api/painel.js`). Mudou os controles em `scripts/importar-deck.py`? Mude também `lib/controles.js`.
- Variáveis na Vercel (produção): `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` (service_role). Cópia local em `.env-supabase` (fora do git). Sem elas o painel mostra o aviso e só o estático funciona.
- O cron diário `api/manter-ativo` (vercel.json) evita que o Supabase gratuito pause por inatividade.
- Versões enviadas pelo painel não estão no git. Não apague o índice nem os buckets.

## Ao atualizar uma proposta
Edite só a pasta daquele cliente. Nunca renomeie a pasta (o link do cliente quebraria).

## Não fazer
- Não alterar `modelo/proposta.html` a menos que peçam para mudar o modelo padrão.
- Não apagar propostas antigas sem pedido explícito.
