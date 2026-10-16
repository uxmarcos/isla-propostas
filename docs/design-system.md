# Isla — Design System (landing page)

Especificação extraída da landing page da Isla (`isla-landing`, out/2026) para replicar o mesmo padrão visual em outras páginas, produtos ou ferramentas de geração de UI (v0, Lovable, Replit, Claude, etc.).

> **Em uma frase:** escuro, monocromático e editorial. Serifa grande e fina nos títulos, sans discreta no texto, superfícies de vidro escuro com bordas finas (hairlines), granulação de filme por cima de tudo e movimento lento e pesado, sem nada saltitante. **A única cor de destaque é a própria luz (branco).**

---

## 1. Princípios

1. **Monocromático estrito.** Preto, brancos quentes e cinzas. Nada de azul de marca nem gradientes coloridos. Cor só aparece como *dado* (status de um card no mockup do produto), nunca como decoração.
2. **A luz é o destaque.** Ênfase vem de brilho (glow branco suave), contraste e itálico, e não de cor.
3. **Editorial, não SaaS genérico.** Títulos em serifa display enormes, com palavras-chave em *itálico*. Muito espaço negativo.
4. **Hairlines, não sombras pesadas.** Divisões com bordas de 1px a 10% de opacidade. Profundidade com sombras longas e escuras + um realce interno de 1px no topo.
5. **Movimento lento e pesado.** Easing expo-out, durações de 0,9 a 1,4 s, revelações uma vez só. Nunca bounce ou spring elástico.
6. **Mostrar o produto trabalhando.** Cada seção tem uma animação/mockup que *demonstra* o que o texto diz (cursor do agente movendo cards, post sendo escrito e aprovado, feed sendo escaneado).
7. **Scroll travado só com moderação.** Um "pin" leve pode segurar uma sequência curta no desktop. **No mobile, nunca trave o scroll.**

---

## 2. Cores

### Tokens

| Token | Valor | Uso |
|---|---|---|
| `ink` | `#0A0A0A` | Fundo da página, `theme-color`, texto sobre botão claro |
| `ink-2` | `#141414` | Superfícies elevadas, base do vidro |
| `ink-3` | `#1F1F1F` | Superfícies internas, trilhos, skeletons |
| `porcelain` | `#F5F5F2` | Texto principal, botão primário, glows (branco *quente*, nunca `#FFF` puro) |
| `grey-1` | `#A3A3A3` | Texto secundário, lede, eyebrows, labels |
| `grey-2` | `#6B6B6B` | Texto terciário, separadores "·", estados inativos |
| `line` | `rgb(245 245 242 / 0.10)` | Hairlines, bordas de cards |
| `line-strong` | `rgb(245 245 242 / 0.18)` | Borda do botão ghost, divisões com mais presença |

Superfícies sólidas extras usadas em mockups: `#121212` (card sólido), `#050505` (fundo do card de preço), `#1A1A1A` / `#3A3A3A` / `#4A4A4A` / `#8A8A8A` (cinzas de UI do mockup).

### Cores de dado (apenas dentro de mockups do produto)

Usadas **só** como bolinhas de status das colunas do Kanban, para parecer a plataforma real:

| Estágio | Cor |
|---|---|
| Connecting / Engaging | `#8B7CF6` |
| Ready to Reach Out | `#F0913F` |
| Reaching Out | `#4F8FF7` |
| Meeting Booked | `#3FBF73` (inclui um pulso verde único quando um card chega) |

Fora desse contexto, não use cor.

### Regras
- Seleção de texto invertida: fundo `porcelain`, texto `ink`.
- Foco: `outline: 1px solid porcelain; outline-offset: 4px; border-radius: 4px`.
- `color-scheme: dark` e `<meta name="theme-color" content="#0A0A0A">`.

---

## 3. Tipografia

### Famílias (Google Fonts)

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@300;400;500&display=swap" />
```

| Papel | Fonte | Fallback |
|---|---|---|
| Display (h1–h3, números grandes) | **Instrument Serif** 400, regular + *italic* | `'Times New Roman', serif` |
| Texto/UI | **Inter Tight** 300 / 400 / 500 | `ui-sans-serif, system-ui, -apple-system, sans-serif` |

- Títulos são **sempre peso 400** (nunca bold). Ênfase = `<em>` em itálico.
- Body: 16px, `line-height: 1.6`, peso 400, antialiased, `text-rendering: optimizeLegibility`.
- `text-wrap: balance` nos títulos e `text-wrap: pretty` nos parágrafos.
- Números de métricas: serifa display + `tabular-nums`.

### Escala

| Estilo | Fonte | Tamanho | Line-height | Tracking |
|---|---|---|---|---|
| Hero | Display | `clamp(40px, 5.6vw, 88px)` (máx. ~26ch) | 0.98 | -0.025em |
| Hero XL (alternativo) | Display | `clamp(48px, 8vw, 128px)` | 0.95 | -0.025em |
| H2 | Display | `clamp(36px, 5vw, 72px)` (máx. ~16ch) | 1.02 | -0.02em |
| H3 | Display | `clamp(26px, 2.6vw, 36px)` | 1.1 | -0.01em |
| Linha de tabela/destaque | Display | 28px | — | — |
| Métrica | Display | `clamp(32px, 3.2vw, 44px)` | 1 | — |
| Lede | Sans | `clamp(17px, 1.35vw, 20px)`, cor `grey-1` | 1.55 | — |
| Body | Sans | 16px | 1.6 | — |
| Small / meta | Sans | 13px, cor `grey-1` | — | — |
| Eyebrow | Sans 500 | 11px, UPPERCASE, cor `grey-1` | — | 0.22em |

**Eyebrow:** sempre precedido por um traço horizontal de 24×1px em `grey-2` com gap de 12px (`— TEXTO`). No mobile o traço pode sumir.

**Padrão de título:** frase curta e declarativa, terminada em ponto, com 1–3 palavras finais em itálico.
Ex.: "Turn your LinkedIn into *booked sales meetings*."

---

## 4. Layout e espaçamento

```css
:root {
  --gutter: 16px;        /* ≥768px: 32px · ≥1280px: 48px */
  --nav-h: 72px;
  --container: 1320px;
}
.container-page {
  width: 100%;
  max-width: calc(var(--container) + var(--gutter) * 2);
  margin-inline: auto;
  padding-inline: var(--gutter);
}
```

- **Ritmo vertical das seções:** `padding-block: 128px` (mobile) → `176px` (≥768px). Seções com pin usam altura em `vh` (ex.: 440vh–520vh) só no desktop.
- **Título → conteúdo:** 64px (`mt-16`). Título → lede: ~24–28px. Lede → CTAs: ~36px.
- **Hero:** `min-height: 100svh`, conteúdo centralizado, topo em `calc(var(--nav-h) + 6svh)`; mockup do produto abaixo dos CTAs, ocupando `clamp(300px, 46svh, 480px)`.
- **Grades:** 2 colunas no desktop (texto à esquerda, animação à direita) e 1 coluna no mobile, com o mockup abaixo do texto.
- **Breakpoints:** xs 416px, sm 640px, md 768px, lg 1024px, xl 1280px. Teste também em 380px (telas muito estreitas empilham listas inline).
- Nunca deixe a página rolar na horizontal (`overflow-x: clip` no body).
- `scroll-padding-top: var(--nav-h)` para âncoras.

### Raios

| Elemento | Raio |
|---|---|
| Botões, pills, nav, badges, avatares | `9999px` (full) |
| Cards de conteúdo | 16px (`2xl`) – 24px (`3xl`) |
| Card de preço / painéis hero | 24–32px |
| Elementos internos de mockup (inputs, chips) | 6–12px |

---

## 5. Superfícies e efeitos

### Vidro escuro (`glass`)
```css
background: linear-gradient(180deg, rgb(245 245 242 / .045), rgb(245 245 242 / .015));
background-color: rgb(20 20 20 / .55);
backdrop-filter: blur(20px) saturate(120%);
border: 1px solid rgb(245 245 242 / .10);
box-shadow:
  inset 0 1px 0 0 rgb(245 245 242 / .09),   /* realce de 1px na borda de cima */
  0 30px 60px -30px rgb(0 0 0 / .8);         /* sombra longa e escura */
```

### Card sólido (`card-solid`)
Mesmo visual, sem `backdrop-filter` (use dentro de transformações 3D, porque blur + `preserve-3d` causa flicker):
```css
background: linear-gradient(180deg, rgb(245 245 242 / .05), rgb(245 245 242 / .02)), #121212;
border: 1px solid rgb(245 245 242 / .10);
box-shadow: inset 0 1px 0 0 rgb(245 245 242 / .09), 0 30px 60px -30px rgb(0 0 0 / .8);
```

### Card de preço ("obsidiana")
```css
background:
  linear-gradient(160deg, rgb(245 245 242 / .07), transparent 38%),
  linear-gradient(180deg, #121212, #050505);
box-shadow:
  inset 0 1px 0 rgb(245 245 242 / .16),
  0 60px 120px -40px rgb(0 0 0 / .9),
  0 0 80px rgb(245 245 242 / .04);
```
Com reflexo especular que segue o cursor (`radial-gradient(420px circle at var(--mx) var(--my), rgb(245 245 242 / .1), transparent 60%)` em `mix-blend-mode: screen`), leve tilt 3D e flutuação de 8px em loop de 9s.

### Destaque "é a Isla"
Linha ou card em destaque: gradiente horizontal `rgb(245 245 242 / .06) → .015`, filete interno de 1px à esquerda a 50% e glow `0 0 60px rgb(245 245 242 / .05)`. As outras opções ficam em `grey-1`.

### Glow
`--glow: 0 0 40px rgb(245 245 242 / .08), 0 0 120px rgb(245 245 242 / .04);`
Nó ativo: `0 0 18px rgb(245 245 242 / .8), 0 0 48px rgb(245 245 242 / .25)`.

### Hairlines
`border-top/bottom: 1px solid rgb(245 245 242 / .10)` separa faixas (prova social, linhas de tabela, FAQ).

### Granulação de filme (obrigatória)
Camada fixa sobre tudo, opacidade **4,5%**, `pointer-events: none`, `z-index` alto, com ruído SVG `feTurbulence` (`baseFrequency .85`, 3 oitavas) animado em `steps(6)` a cada 1,2s, com deslocamentos de ±3%.

### Véus de legibilidade
Sobre fundos 3D/claros, use gradientes de `ink` (de cima para baixo ou da esquerda até ~50%) sutis o bastante para não parecerem um overlay. Ex.: `linear-gradient(180deg, ink 0%, rgb(10 10 10/.7) 30%, rgb(10 10 10/.2) 52%, transparent 65%)`.

### Fundo
Preto sólido + linhas de contorno topográficas finas (SVG, ~60% de opacidade) + cenas 3D de oceano/ilhas (React Three Fiber) em escala de cinza. A metáfora visual é a do mar e do arquipélago: "No founder should be an island".

### Máscaras de borda
Marquees e trilhos horizontais: `mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)`.

---

## 6. Componentes

### Botões (sempre pill)
| Variante | Estilo |
|---|---|
| **Primary** | fundo `porcelain`, texto `ink`, `inset 0 -1px 0 rgb(0 0 0/.12)`; no hover, glow `0 0 40px rgb(245 245 242/.22)` |
| **Ghost** | borda `line-strong`, texto `porcelain`; no hover, borda `porcelain/50` e fundo `porcelain/4%` |

| Tamanho | Altura | Padding X | Fonte |
|---|---|---|---|
| sm | 36px | 16px | 13px |
| md | 44px | 20px | 14px |
| lg | 52px | 28px | 15px |

- Fonte 500, tracking -0.005em, `active: scale(.98)`, transições de 500ms `ease-heavy`.
- Seta opcional: SVG 14px, traço de 1.25, desliza 2px para a direita no hover.
- Par padrão: **[Book a 15-min call →]** (primary) + **[See how it works]** (ghost).

### Navbar
Fixa no topo, altura 72px, em forma de pill de vidro centralizada no container. No scroll ela fica compacta (o wordmark cai de 26px para 20px e os links somem). Ordem: wordmark | links (gap 28px) | seletor de idioma EN/PT | Login | CTA primary sm. No mobile, CTA e seletor de idioma ficam sempre visíveis.

### Eyebrow
`— TEXTO` (traço de 24px + 11px uppercase com tracking 0.22em).

### Lista de promessas
Itens de 13px em `grey-1`, separados por `·` em `grey-2`. Em telas de até 380px empilham, sem separador.

### Faixa de prova social
Hairline em cima, label eyebrow "Trusted by founders at" e marquee de logos monocromáticos (48s/loop, pausa no hover).

### Métricas
Número em serifa display grande + label de 13px em `grey-1` embaixo. **Nunca invente números:** use placeholders `[X]` até ter o dado real.

### Tabela comparativa
Cabeçalhos em eyebrow `grey-2`. Linhas com hairline, padding vertical de 28px, nome da opção em serifa de 28px. A linha da Isla ganha o destaque descrito na seção 5 e fica em `porcelain`; as demais ficam em `grey-1`. No mobile vira cards empilhados.

### Mockups do produto
Recriações escuras e simplificadas da UI real (Kanban, feed do LinkedIn em dark mode, calendário semanal, editor de post), com skeletons em `ink-3`, um cursor "Isla Agent" com label e textos sempre em inglês.

---

## 7. Movimento

### Easing e duração
```css
--ease-heavy:  cubic-bezier(0.16, 1, 0.3, 1);      /* expo.out — padrão */
--ease-power3: cubic-bezier(0.215, 0.61, 0.355, 1); /* power3.out */
--ease-inout:  cubic-bezier(0.65, 0, 0.35, 1);      /* power3.inOut */
```
- Microinterações (hover, botões, nav): **500ms** `ease-heavy`.
- Entradas: **1100–1400ms** `ease-heavy`.
- Estados que mudam (nó ativo): **900ms**.
- Nada de bounce, overshoot ou spring.

### Padrões de entrada
1. **Rise (títulos):** cada palavra sobe de `translateY(105%)` até 0 dentro de uma máscara `overflow: hidden` (com padding de 0.06em/0.12em para o itálico e as descendentes), em 1.15s `ease-heavy`, com **60ms** de stagger entre palavras. No hero toca no load; nos outros h2 toca **uma vez**, quando o título entra na viewport (`rootMargin: 0 0 -12% 0`).
2. **Hero-in (resto do hero):** `opacity 0 → 1` + `translateY(16px → 0)` em 1.1s, com delays em cascata: eyebrow 100ms, palavras 180ms + 60ms·i, lede 650ms, CTAs 800ms, promessas 900ms, mockup 1000ms, prova social 1100ms. Tudo fica pausado até o loader liberar a página.
3. **Reveal (blocos):** `opacity 0 → 1` + `translateY(32px → 0)` em 1.4s, uma vez, com `delay` opcional por item.

### Loops ambientes
- Granulação: 1.2s em `steps(6)`.
- Marquee: 48s, linear.
- Fluxo em conectores SVG: `stroke-dasharray: 6 18`, 2.4s, linear.
- Flutuação do card de preço: 9s, ±8px.
- Micro-ilustrações dos cards: loop compartilhado de 7s (`--loop`), todas sincronizadas.
- Ripple ao aprovar: anel de 1px a 30% que escala até 240vmax e some em 2.6s.

### Scroll
- **Lenis** smooth scroll (`lerp ≈ 0.25`) + **GSAP ScrollTrigger** para scrub e pin.
- Sequências com pin: só no desktop e em telas altas. Mantenha-as curtas (uma "travadinha", não uma parede). No mobile, mostre a mesma história em ordem, sem pin.
- Gatilhos automáticos (a timeline toca sozinha quando a seção entra) são preferíveis a amarrar cada frame ao scroll quando o usuário poderia "perder" a animação.
- Drag no hero: só no desktop; no mobile, o Kanban apenas se anima sozinho.

### Reduced motion
Hoje a flag `HONOR_REDUCED_MOTION = false` mantém as animações sempre ativas. Se for respeitar a preferência do sistema, cada animação precisa de um estado final estático e bonito: títulos já visíveis, loops pausados no frame que mostra o resultado e sequências pinadas convertidas em lista.

---

## 8. 3D (opcional)

React Three Fiber + drei. Cenas em escala de cinza: oceano com água não metálica, logo 3D da Isla, farol com feixe de luz, arquipélago para o pipeline. Em telas pequenas, use a flag "lite" (DPR menor, água mais simples, menos segmentos) em vez de remover a animação. Sempre tenha fallback em SVG para quem não tem WebGL.

---

## 9. Voz e conteúdo

- Copy da página em **inglês**, com toggle EN/PT. Frases curtas, declarativas, terminadas em ponto.
- Tese central: *a Isla devolve o tempo do founder. Nós fazemos; você só aprova.*
- Fórmula de CTA: verbo + compromisso pequeno ("Book a 15-min call").
- Nunca publique métricas, logos ou depoimentos inventados: use `[X]` até ter o dado real.

---

## 10. Checklist para um design novo

- [ ] Fundo `#0A0A0A` + granulação de 4,5% + (opcional) contornos topográficos
- [ ] Só preto, branco quente `#F5F5F2` e cinzas `#A3A3A3` / `#6B6B6B`, com cor apenas como dado de produto
- [ ] Títulos em Instrument Serif 400, palavras-chave em itálico, terminados em ponto
- [ ] Texto em Inter Tight; lede em `grey-1`; eyebrow `— UPPERCASE` de 11px
- [ ] Cards de vidro escuro com borda de 1px a 10% + realce interno no topo + sombra longa
- [ ] Botões pill: primary claro com glow no hover e ghost com hairline
- [ ] Container de 1320px, gutter 16/32/48px, seções com 128/176px de padding vertical
- [ ] Títulos com Rise palavra a palavra (stagger de 60ms), blocos com Reveal, easing expo-out e nada saltitante
- [ ] Cada seção demonstra o produto com um mockup animado
- [ ] Mobile: uma coluna, sem scroll travado, sem rolagem horizontal, testado em 380px

---

## 11. Snippet base (Tailwind v4)

```css
@import 'tailwindcss';

@theme {
  --color-ink: #0a0a0a;
  --color-ink-2: #141414;
  --color-ink-3: #1f1f1f;
  --color-porcelain: #f5f5f2;
  --color-grey-1: #a3a3a3;
  --color-grey-2: #6b6b6b;
  --color-line: rgb(245 245 242 / 0.1);
  --color-line-strong: rgb(245 245 242 / 0.18);

  --font-display: 'Instrument Serif', 'Times New Roman', serif;
  --font-sans: 'Inter Tight', ui-sans-serif, system-ui, -apple-system, sans-serif;

  --ease-heavy: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-power3: cubic-bezier(0.215, 0.61, 0.355, 1);
  --ease-inout: cubic-bezier(0.65, 0, 0.35, 1);

  --breakpoint-xs: 26rem;
}

:root { --gutter: 16px; --nav-h: 72px; --container: 1320px; }
@media (min-width: 768px)  { :root { --gutter: 32px; } }
@media (min-width: 1280px) { :root { --gutter: 48px; } }

@layer base {
  html { background: var(--color-ink); color: var(--color-porcelain); color-scheme: dark;
         -webkit-font-smoothing: antialiased; scroll-padding-top: var(--nav-h); }
  body { font-family: var(--font-sans); font-size: 16px; line-height: 1.6; overflow-x: clip; }
  ::selection { background: var(--color-porcelain); color: var(--color-ink); }
  h1, h2, h3 { font-family: var(--font-display); font-weight: 400; letter-spacing: -0.02em; text-wrap: balance; }
  h1 em, h2 em, h3 em { font-style: italic; }
  p { text-wrap: pretty; }
}

@utility text-h2   { font-family: var(--font-display); font-size: clamp(36px, 5vw, 72px); line-height: 1.02; letter-spacing: -0.02em; }
@utility text-h3   { font-family: var(--font-display); font-size: clamp(26px, 2.6vw, 36px); line-height: 1.1; letter-spacing: -0.01em; }
@utility text-lede { font-size: clamp(17px, 1.35vw, 20px); line-height: 1.55; color: var(--color-grey-1); }
@utility eyebrow   { font-size: 11px; font-weight: 500; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-grey-1); }
@utility container-page { width: 100%; max-width: calc(var(--container) + var(--gutter) * 2); margin-inline: auto; padding-inline: var(--gutter); }
@utility glass {
  background: linear-gradient(180deg, rgb(245 245 242 / .045), rgb(245 245 242 / .015));
  background-color: rgb(20 20 20 / .55);
  backdrop-filter: blur(20px) saturate(120%);
  border: 1px solid var(--color-line);
  box-shadow: inset 0 1px 0 0 rgb(245 245 242 / .09), 0 30px 60px -30px rgb(0 0 0 / .8);
}

/* Rise palavra a palavra */
.hero-mask { display: inline-block; overflow: hidden; vertical-align: top; padding: 0 .06em .12em; margin: 0 -.06em -.12em; }
.rise-word { display: inline-block; transform: translateY(105%); }
.is-in .rise-word { animation: rise 1.15s var(--ease-heavy) forwards; } /* delay: index * 60ms */
@keyframes rise { to { transform: translateY(0); } }
```
