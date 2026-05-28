@echo off
cd /d "%~dp0"
echo Starting local preview at http://localhost:3000
echo Open this URL in your browser (do not double-click index.html)
start http://localhost:3000
npx --yes serve . -l 3000
