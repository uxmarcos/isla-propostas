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

## Ao atualizar uma proposta
Edite só a pasta daquele cliente. Nunca renomeie a pasta (o link do cliente quebraria).

## Não fazer
- Não alterar `modelo/proposta.html` a menos que peçam para mudar o modelo padrão.
- Não apagar propostas antigas sem pedido explícito.
