#!/bin/zsh
LABEL="br.com.praca.leads-bridge"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
echo "Ponte removida. Ela não inicia mais sozinha."
echo "Para rodar manualmente, use o atalho Abrir busca automatica."
