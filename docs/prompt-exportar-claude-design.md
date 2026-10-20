# Prompt: preparar um projeto do Claude Design para publicar

Cole o texto abaixo no chat de **cada projeto** do Claude Design que tem apresentações. Depois baixe o projeto inteiro (.zip), descompacte em `~/Documents/ISLA/Clientes/<Cliente>/` e peça ao Claude deste repositório: "importa as apresentações novas".

---

Vou publicar as apresentações deste projeto fora do Claude Design, num site estático na Vercel. O site usa os próprios arquivos do projeto (`.dc.html`, `support.js`, `deck-stage.js`, `image-slot.js`, `assets/` e `figma/`). Prepare o projeto para essa exportação **sem mudar o visual nem o texto dos slides**:

1. **Inventário.** Liste todas as apresentações (`.dc.html`) deste projeto e diga, para cada uma, se é uma proposta para um cliente ou um modelo/rascunho.

2. **Imagens como arquivos.** Toda imagem usada precisa estar como arquivo dentro de `assets/`, referenciada por caminho relativo (`assets/...`).
   - Se alguma imagem foi arrastada para um `<image-slot>` (fica em `.image-slots.state.json`), salve-a em `assets/` e coloque o caminho no atributo `src` do slot.
   - Se alguma imagem vem de um link externo (Unsplash, etc.), baixe para `assets/` e troque o link, mantendo o crédito quando houver.
   - Fontes do Google Fonts podem ficar como estão.

3. **Sem espaços vazios.** Nenhum `<image-slot>` das propostas pode ficar sem imagem. Se faltar imagem para algum, me diga quais em vez de inventar.

4. **Estrutura do deck.** Mantenha a navegação padrão (`<x-import component-from-global-scope="deck-stage" ...>`), com cada slide como um `<section>` direto. Não adicione setas, botão de PDF nem analytics: o site coloca isso sozinho.

5. **Manifesto.** Crie na raiz do projeto o arquivo `isla-export.json` neste formato:

   ```json
   {
     "apresentacoes": [
       {
         "arquivo": "Nome exato do arquivo.dc.html",
         "cliente": "Nome do cliente",
         "slug": "cliente-assunto",
         "titulo": "Isla × Cliente · Proposta",
         "tipo": "proposta"
       }
     ]
   }
   ```

   - `slug`: só letras minúsculas, números e hífen (ex.: `zazos`, `zazos-follow-up`), único por apresentação. Ele vira o link: `/slug`.
   - `tipo`: `"proposta"` para o que vai para o cliente; `"modelo"` para modelos e rascunhos (não são publicados).
   - Inclua todas as apresentações do projeto, inclusive os modelos.

6. **Resumo.** No final, mostre o conteúdo do `isla-export.json` e uma lista curta do que você mudou.
