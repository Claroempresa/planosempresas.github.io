# Planos Claro para empresas — Revenda Autorizada

Catálogo de planos Claro para enviar aos clientes pelo WhatsApp.

- Evelyn Hartmann: https://planosempresas.github.io/
- Everton Maia: https://planosempresas.github.io/everton/

## Links diretos (funcionam em qualquer consultor, ex.: `.../everton/#internet`)
- Portabilidade: https://planosempresas.github.io/#portabilidade
- Transferência de CPF para CNPJ: https://planosempresas.github.io/#transferencia
- Linha nova (CNPJ): https://planosempresas.github.io/#linha-nova
- Internet Wi-Fi: https://planosempresas.github.io/#internet
- Combo internet + Claro Pós: https://planosempresas.github.io/#combo

## Como alterar
- O site da Evelyn é o `index.html` e serve de modelo para os demais consultores.
- **Preços e textos:** edite o `index.html` (blocos `CATÁLOGO 1`, `CATÁLOGO 2`, `CATÁLOGO 3` e `COMBO`). Mude o valor no plano e também no `data-plano`/`data-combo` do botão, que é a mensagem enviada no WhatsApp. Depois rode `python3 gerar_consultores.py` para atualizar os outros consultores.
- **WhatsApp da Evelyn:** no final do `index.html`, `var WHATSAPP = "..."` (55 + DDD + número, só números).
- **Cores:** bloco "CORES" no início do `index.html`.
- **Imagens:** `retrato.jpg` (foto da Evelyn), `capa.jpg` (prévia do link no WhatsApp), `claro-revenda.png` (selo Revenda Autorizada), `logos/` (logos dos benefícios, recortados do Book Claro empresas out/2026).

## Consultores
Cada consultor tem uma pasta gerada pelo `gerar_consultores.py` — não edite `everton/index.html` direto.
Para adicionar um consultor: inclua os dados na lista `CONSULTORES`, coloque a foto (quadrada) em `<pasta>/foto.jpg` e rode o script.
