# Propostas Isla

Cada proposta é uma página no ar em `proposta.<dominio-da-isla>/<cliente>`.
Fez a proposta (no Claude Design, no Claude ou na mão), colocou aqui, deu push: em ~1 minuto está publicada.

## Como funciona

- O repositório está conectado à **Vercel**. Todo `git push` na `main` publica automaticamente (sem GitHub Actions).
- Cada pasta dentro de `site/` vira uma rota:

```
site/
  index.html          → proposta.isla.../            (painel com senha, gerado)
  _painel/thumbs/     → miniaturas do painel (com senha)
  404.html            → link errado
  exemplo/index.html  → proposta.isla.../exemplo
  abacate/index.html  → proposta.isla.../abacate
modelo/proposta.html  → modelo base (não vai pro ar)
middleware.js         → login do painel (página /login, cookie de sessão)
scripts/gerar-painel.mjs, importar-deck.py, nova-proposta.sh
vercel.json           → configurações (noindex, URLs limpas, rotas externas)
```

## Painel

A página inicial lista todas as apresentações, com miniatura, busca e "Copiar link". Só abre com login (e-mail e senha) em `/login`; os links das propostas continuam abertos para os clientes.

- **Atualizar:** `node scripts/gerar-painel.mjs` e push (os scripts de importação já fazem a primeira parte).
- **Dar/tirar acesso:** na Vercel, projeto `isla-propostas` → Settings → Environment Variables → `PAINEL_ACESSOS` (Production), no formato `marcos@isla.to:senha,ana@isla.to:outrasenha`. `PAINEL_SEGREDO` assina as sessões (trocar desloga todo mundo). Depois, faça um redeploy (Deployments → ⋯ → Redeploy) para valer.

## Criar uma proposta

### Opção A: apresentação feita no Claude Design
Se baixou o projeto inteiro (pasta com `.dc.html`, `support.js`, `assets/`…):
```bash
python3 scripts/importar-deck.py ~/Documents/ISLA/Clientes/Abacate/"Abacate - Pitch" "Abacate Pitch.dc.html" abacate "Isla × Abacate · Proposta"
git add site/abacate && git commit -m "Proposta: Abacate" && git push
```

Se exportou como **HTML** (arquivo único):
1. No Claude Design, exporte/baixe a apresentação como **HTML** (arquivo único).
2. Rode:
   ```bash
   ./scripts/nova-proposta.sh abacate "Abacate Ltda" ~/Downloads/apresentacao.html
   git add site/abacate && git commit -m "Proposta: Abacate" && git push
   ```
3. Manda o link: `proposta.<dominio>/abacate`

### Opção B: a partir do modelo da Isla
```bash
./scripts/nova-proposta.sh abacate "Abacate Ltda"
```
Edite `site/abacate/index.html` (ou peça pro Claude editar) e dê push.

### Opção C: pedir pro Claude fazer tudo
Abra uma sessão do Claude com este repositório e peça, por exemplo:
> "Cria a proposta do Abacate em /abacate com base nessas informações: ..."

O `CLAUDE.md` explica pro Claude como fazer.

### Opção D: proposta que é um projeto separado
Se uma proposta for um projeto próprio na Vercel (por exemplo, um import direto do Claude Design), adicione uma rota no `vercel.json`:

```json
"rewrites": [
  { "source": "/fulano", "destination": "https://fulano-proposta.vercel.app/" },
  { "source": "/fulano/:path*", "destination": "https://fulano-proposta.vercel.app/:path*" }
]
```

## Atualizar uma proposta
Edite o arquivo e dê push. O link continua o mesmo.

## Recursos do modelo
- Animação de entrada ao rolar a página
- Espaço para vídeo de fundo no topo (coloque o `.mp4` na pasta da proposta)
- Botão **Baixar PDF** (gera o PDF pela impressão do navegador, com layout próprio)
- Botão de WhatsApp (troque o número em `modelo/proposta.html`)
- Vercel Web Analytics: mostra quando a proposta foi aberta (ative em *Analytics* no projeto da Vercel)
- Nenhuma proposta aparece no Google (`noindex`)

## Configuração inicial (uma vez só)
1. Criar este repositório no GitHub e dar push.
2. Na Vercel: **Add New → Project → Import** este repositório (sem configurar nada; o `vercel.json` já cuida).
3. Em **Settings → Domains**, adicionar `proposta.<dominio-da-isla>`.
4. No DNS do domínio, criar um registro **CNAME** `proposta` apontando para `cname.vercel-dns.com`.
5. Em **Analytics**, ativar o Web Analytics.

> Os slugs precisam ser difíceis de chutar se a proposta tiver valores sensíveis (ex: `abacate-7f3k` em vez de `abacate`).
