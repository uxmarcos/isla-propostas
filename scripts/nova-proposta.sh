#!/usr/bin/env bash
# Cria uma proposta nova a partir do modelo.
# Uso:
#   ./scripts/nova-proposta.sh abacate "Abacate Ltda"
#   ./scripts/nova-proposta.sh abacate "Abacate Ltda" ~/Downloads/proposta-abacate.html   (usa um HTML exportado do Claude Design)
set -euo pipefail

SLUG="${1:-}"
CLIENTE="${2:-}"
ARQUIVO="${3:-}"

if [[ -z "$SLUG" || -z "$CLIENTE" ]]; then
  echo "Uso: $0 <slug> \"<Nome do cliente>\" [arquivo.html]"
  exit 1
fi

if [[ ! "$SLUG" =~ ^[a-z0-9-]+$ ]]; then
  echo "O slug deve ter só letras minúsculas, números e hífen (ex: abacate, padaria-do-ze)."
  exit 1
fi

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DESTINO="$RAIZ/site/$SLUG"

if [[ -e "$DESTINO" ]]; then
  echo "Já existe uma proposta em site/$SLUG."
  exit 1
fi

mkdir -p "$DESTINO"

if [[ -n "$ARQUIVO" ]]; then
  cp "$ARQUIVO" "$DESTINO/index.html"
  echo "HTML copiado para site/$SLUG/index.html"
else
  DATA="$(date +%m/%Y)"
  sed -e "s/{{CLIENTE}}/$CLIENTE/g" -e "s#{{DATA}}#$DATA#g" "$RAIZ/modelo/proposta.html" > "$DESTINO/index.html"
  echo "Proposta criada a partir do modelo em site/$SLUG/index.html"
fi

echo ""
echo "Próximo passo:"
echo "  git add site/$SLUG && git commit -m \"Proposta: $CLIENTE\" && git push"
echo "Depois do push, fica no ar em: https://proposta.<dominio-da-isla>/$SLUG"
