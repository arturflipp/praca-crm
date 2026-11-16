#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js não encontrado. Instale em https://nodejs.org e tente de novo."
  read -r "?Pressione Enter para fechar."
  exit 1
fi
node scripts/buscar-leads.mjs
read -r "?Pressione Enter para fechar."
