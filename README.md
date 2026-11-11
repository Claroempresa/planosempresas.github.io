# Claro Empresas | Consultoria

Site de atendimento de Revenda Autorizada Claro, com uma página por consultor. Os endereços não mudam:

- Evelyn: https://claroempresa.github.io/planosempresas.github.io/
- Everton: .../everton/ · Kauan: .../kauan/ · Camily: .../camily/

Hospedado no GitHub Pages. Sem framework e sem etapa de build no navegador (HTML, CSS e JS puros).

## Como atualizar (regra de ouro: **não edite `index.html`, `everton/`, `kauan/`, `camily/`**)

Essas páginas são geradas. Edite só a fonte e o site inteiro se atualiza sozinho (GitHub Actions) quando a mudança entra na `main`:

| Quero mudar | Edite |
|---|---|
| Preço, plano, promoção, benefício do plano | `fonte/planos.json` (e ponha `"aprovado": true` só depois da aprovação) |
| Benefícios, perguntas frequentes | `dados/beneficios.json`, `dados/faq.json` |
| Depoimentos (só reais e autorizados) | `dados/depoimentos.json`: `{"nome","empresa","texto","autorizado":true}` |
| Visual | `css/app.css`, `modelo/index.html` |
| Comportamento | `js/` |
| Adicionar consultor | `fonte/consultores.json` + foto em `<pasta>/foto.jpg` |

Para gerar na hora: `python3 scripts/gerar.py`.

## Catálogo de planos (`fonte/planos.json`)
Cada item tem id, categoria (`movel`, `fibra`, `combo`, `solucao`), franquia, bônus, internet total, valor mensal, promoção (`{"meses","valorDepois"}`), pagamento, fidelidade, benefícios, restrições, grupo de mercado, data de referência, **página do material comercial que fundamenta a informação** e `aprovado`. Só itens com `aprovado: true` vão ao site, e a página do material nunca vai para o arquivo público (`dados/planos.json`).

## Testes
- `node --test tests/unidade.test.js`: contas do simulador, preços do catálogo e mensagens de WhatsApp.
- `python3 -m http.server 8765 --bind 127.0.0.1` e `node tests/e2e.js`: fluxos no navegador (Playwright), larguras de 320 a 1440 px e acessibilidade (axe-core).

## Cuidados
- O material comercial de origem é de uso interno: **não** coloque o arquivo nem tabelas internas neste repositório.
- Não escreva "cobertura confirmada" sem integração real: a consulta de cobertura só encaminha o pedido por WhatsApp.
