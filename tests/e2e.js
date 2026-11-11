// Testes de ponta a ponta no navegador. Precisam do site servido em http://127.0.0.1:8765
//   (cd <repo> && python3 -m http.server 8765 --bind 127.0.0.1)   e   node tests/e2e.js
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://127.0.0.1:8765";
const CONSULTORES = [
  { pasta: "", nome: "Evelyn", numero: "5542998242620" },
  { pasta: "everton/", nome: "Everton", numero: "5541987482014" },
  { pasta: "kauan/", nome: "Kauan", numero: "554298484317" },
  { pasta: "camily/", nome: "Camily", numero: "554299476786" },
];

let falhas = 0, total = 0;
async function teste(nome, fn) {
  total++;
  try { await fn(); console.log("  ok   ", nome); }
  catch (e) { falhas++; console.log("  FALHOU", nome, "\n        ", String(e.message).split("\n").slice(0, 14).join("\n         ")); }
}

const navegador = await chromium.launch();
async function abrir(url, largura = 390, altura = 844) {
  const ctx = await navegador.newContext({ viewport: { width: largura, height: altura }, deviceScaleFactor: 1, serviceWorkers: "allow" });
  await ctx.route(/wa\.me/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "ok" }));
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push("js: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)|Failed to load resource: net::ERR_FAILED/.test(m.text())) erros.push("console: " + m.text()); });
  // Fontes do Google não existem no ambiente de teste: bloqueia para não atrasar.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(BASE + "/" + url);
  await page.waitForFunction(() => document.documentElement.dataset.pronto === "1", null, { timeout: 8000 });
  return { page, ctx, erros };
}
const txt = async (page, sel) => (await page.locator(sel).innerText()).replace(/\s+/g, " ").trim();
const decodeMsg = (href) => decodeURIComponent(href.split("text=")[1] || "");

console.log("\n== Páginas dos 4 consultores ==");
for (const c of CONSULTORES) {
  await teste(`${c.nome}: carrega sem erros e usa o próprio WhatsApp em todos os botões`, async () => {
    const { page, ctx, erros } = await abrir(c.pasta);
    assert.deepEqual(erros, []);
    // percorre todos os serviços para conferir também os botões de cada plano
    const hrefs = [];
    for (const s of ["movel", "fibra", "combo", "solucao"]) {
      await page.click(`#aba-${s}`);
      hrefs.push(...(await page.$$eval("a[href*='wa.me']", (as) => as.map((a) => a.href))));
    }
    assert.ok(new Set(hrefs).size >= 30, `só ${new Set(hrefs).size} links de WhatsApp diferentes`);
    const errados = hrefs.filter((h) => !h.startsWith(`https://wa.me/${c.numero}?text=`));
    assert.deepEqual(errados, []);
    assert.ok((await page.title()).includes(c.nome));
    await page.click("#aba-movel");
    assert.equal(await page.locator("#lista-planos .cartao").count(), 6);
    await ctx.close();
  });
}

console.log("\n== Responsividade (sem rolagem horizontal) ==");
for (const largura of [320, 375, 390, 768, 1024, 1440]) {
  await teste(`largura ${largura}px`, async () => {
    for (const pasta of ["", "kauan/"]) {
      const { page, ctx } = await abrir(pasta, largura, 800);
      for (const servico of ["movel", "fibra", "combo", "solucao"]) {
        await page.click(`#aba-${servico}`);
        const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
        assert.ok(w[0] <= w[1], `${pasta || "raiz"} ${servico}: scrollWidth ${w[0]} > ${w[1]}`);
      }
      await ctx.close();
    }
  });
}

console.log("\n== Jornada A: catálogo, filtros e operações ==");
await teste("serviços mostram a quantidade certa de planos", async () => {
  const { page, ctx } = await abrir("");
  const esperado = { movel: 6, fibra: 4, combo: 15, solucao: 3 };
  for (const [s, n] of Object.entries(esperado)) {
    await page.click(`#aba-${s}`);
    assert.equal(await page.locator("#lista-planos .cartao").count(), n, s);
  }
  await ctx.close();
});
await teste("preços do Claro Pós aparecem como no book", async () => {
  const { page, ctx } = await abrir("");
  const t = await txt(page, "#lista-planos");
  for (const v of ["R$ 34,99", "R$ 44,99", "R$ 54,99", "R$ 74,99", "R$ 89,99", "R$ 149,99"]) assert.ok(t.includes(v), v);
  assert.ok(!t.includes("R$ 29,99") && !t.includes("R$ 39,99"));
  await ctx.close();
});
await teste("filtro de faixa de preço e perfil de uso", async () => {
  const { page, ctx } = await abrir("");
  await page.selectOption("#f-faixa", "ate50");
  assert.equal(await page.locator("#lista-planos .cartao").count(), 2);
  await page.selectOption("#f-faixa", "todas");
  await page.selectOption("#f-perfil", "viagens");
  assert.equal(await page.locator("#lista-planos .cartao").count(), 3);
  await page.selectOption("#f-perfil", "");
  await page.selectOption("#f-gb", "100");
  assert.equal(await page.locator("#lista-planos .cartao").count(), 2);
  await page.selectOption("#f-gb", "0");
  await page.selectOption("#f-ordem", "internet");
  assert.match(await txt(page, "#lista-planos .cartao:first-child"), /150GB/);
  await ctx.close();
});
await teste("quantidade de linhas mostra o total mensal", async () => {
  const { page, ctx } = await abrir("");
  await page.fill("#f-linhas", "3");
  assert.match(await txt(page, "#lista-planos .cartao:first-child"), /Para 3 linhas: R\$ 104,97\/mês/);
  await ctx.close();
});
await teste("a operação muda a mensagem do WhatsApp", async () => {
  const { page, ctx } = await abrir("kauan/");
  const href = () => page.locator('#lista-planos a[data-plano="pos-80"]').getAttribute("href");
  assert.match(decodeMsg(await href()), /^Olá, Kauan! Quero fazer portabilidade para o plano Claro Pós 80GB – R\$ 54,99\.$/);
  await page.check('input[value="transferencia"]');
  assert.match(decodeMsg(await href()), /transferir minha linha do CPF para o CNPJ no plano Claro Pós 80GB/);
  await page.check('input[value="linha-nova"]');
  assert.match(decodeMsg(await href()), /linha nova no plano Claro Pós 80GB/);
  await ctx.close();
});
await teste("fibra e combos pedem o CEP e mostram promoção por tempo limitado", async () => {
  const { page, ctx } = await abrir("");
  await page.click("#aba-fibra");
  const f600 = await txt(page, 'article[data-id="fibra-600"]');
  assert.match(f600, /R\$ 59,90/); assert.match(f600, /Por 3 meses\. Depois, R\$ 99,90\/mês, ou R\$ 89,90\/mês junto com Claro Pós/);
  assert.match(decodeMsg(await page.locator('article[data-id="fibra-600"] a[data-plano]').getAttribute("href")), /O CEP da empresa é: $/);
  await page.click("#aba-combo");
  const c = await txt(page, 'article[data-id="combo-600-80"]');
  assert.match(c, /R\$ 114,89/); assert.match(c, /Depois, R\$ 144,89\/mês/); assert.match(c, /50GB de Mega Bônus/);
  await ctx.close();
});
await teste("links antigos (#portabilidade, #transferencia, #internet, #combo) continuam funcionando", async () => {
  for (const [hash, aba, op] of [["portabilidade", "movel", "portabilidade"], ["transferencia", "movel", "transferencia"], ["linha-nova", "movel", "linha-nova"], ["internet", "fibra"], ["combo", "combo"]]) {
    const { page, ctx } = await abrir("#" + hash);
    assert.equal(await page.getAttribute(`#aba-${aba}`, "aria-selected"), "true", hash);
    if (op) assert.ok(await page.isChecked(`input[value="${op}"]`), hash);
    await ctx.close();
  }
});

console.log("\n== Comparador ==");
await teste("compara até 3, bloqueia categoria diferente e destaca diferenças", async () => {
  const { page, ctx } = await abrir("");
  await page.check("#cmp-pos-20");
  await page.check("#cmp-pos-80");
  assert.equal(await page.locator("#bandeja").isVisible(), true);
  await page.check("#cmp-pos-150");
  assert.equal(await page.locator("#comparacao table").count(), 1);
  assert.ok((await page.locator("#comparacao tr.difere").count()) >= 4);
  assert.match(await txt(page, "#comparacao .recomendacoes"), /Menor mensalidade.*Claro Pós 20GB/i);
  assert.match(await txt(page, "#comparacao .recomendacoes"), /Maior internet.*Claro Pós 150GB/i);
  assert.match(await txt(page, "#comparacao"), /não existe plano “melhor”/i);
  // 4º plano é recusado com explicação
  await page.click("#cmp-pos-30");   // recusado de propósito: clica em vez de marcar
  assert.equal(await page.isChecked("#cmp-pos-30"), false);
  assert.match(await txt(page, "#aviso-comparar"), /até 3 planos/);
  // outra categoria é recusada
  await page.click("#bandeja-limpar");
  await page.check("#cmp-pos-20");
  await page.click("#aba-fibra");
  await page.click("#cmp-fibra-400");
  assert.equal(await page.isChecked("#cmp-fibra-400"), false);
  assert.match(await txt(page, "#aviso-comparar"), /mesma categoria/);
  await ctx.close();
});
await teste("remover plano da tabela e limpar", async () => {
  const { page, ctx } = await abrir("");
  await page.check("#cmp-pos-20"); await page.check("#cmp-pos-30");
  await page.click('button[aria-label="Remover Claro Pós 20GB da comparação"]');
  assert.match(await txt(page, "#comparacao"), /Você escolheu Claro Pós 30GB/);
  assert.equal(await page.isChecked("#cmp-pos-20"), false);
  await page.click("#bandeja-limpar");
  assert.equal(await page.locator("#bandeja").isVisible(), false);
  await ctx.close();
});

console.log("\n== Jornada B: simulador de economia ==");
async function simular(page, { linhas, valor, plano, fibra = "", periodo = "24" }) {
  await page.fill("#s-linhas", String(linhas));
  await page.fill("#s-valor", valor);
  await page.selectOption("#s-plano", plano);
  await page.selectOption("#s-fibra", fibra);
  await page.check(`input[name=periodo][value="${periodo}"]`);
  await page.click('#simulador button[type=submit]');
}
await teste("combo com promoção: valores corretos em 12 e 24 meses", async () => {
  const { page, ctx } = await abrir("kauan/");
  await simular(page, { linhas: 1, valor: "150,00", plano: "pos-20", fibra: "fibra-600" });
  const r = await txt(page, "#resultado");
  assert.match(r, /Economia estimada em 24 meses R\$ 692,64/);
  assert.match(r, /Economia em 12 meses R\$ 391,32/);       // 1800 - 1408,68
  assert.match(r, /Novo valor nos primeiros 3 meses R\$ 94,89\/mês/);
  assert.match(r, /Novo valor depois da promoção R\$ 124,89\/mês/);
  assert.match(r, /Custo Claro no período = soma do valor previsto de cada mês, com a promoção de 3 meses = R\$ 2\.907,36/);
  // trocar o período atualiza sozinho
  await page.check('input[name=periodo][value="12"]');
  assert.match(await txt(page, "#resultado"), /Economia estimada em 12 meses R\$ 391,32/);
  await ctx.close();
});
await teste("sem promoção: 10 linhas de 80GB", async () => {
  const { page, ctx } = await abrir("");
  await simular(page, { linhas: 10, valor: "700", plano: "pos-80" });
  assert.match(await txt(page, "#resultado"), /Economia estimada em 24 meses R\$ 3\.602,40/);
  assert.ok(!/depois da promoção/.test(await txt(page, "#resultado")));
  await ctx.close();
});
await teste("aumento de custo é mostrado como custo adicional", async () => {
  const { page, ctx } = await abrir("");
  await simular(page, { linhas: 1, valor: "20", plano: "pos-150", periodo: "12" });
  const r = await txt(page, "#resultado");
  assert.match(r, /Custo adicional estimado em 12 meses R\$ 1\.559,88/);   // 14999*12 - 2000*12 = 155988
  assert.match(r, /custa mais do que você paga hoje/);
  await ctx.close();
});
await teste("proposta por WhatsApp leva plano, linhas, mensalidade, economia e interesses", async () => {
  const { page, ctx } = await abrir("camily/");
  await page.check("#s-manter"); await page.check("#s-cnpj");
  await page.selectOption("#s-operadora", "Vivo");
  await simular(page, { linhas: 2, valor: "300", plano: "pos-80" });
  const href = await page.locator("#resultado a.botao--whats").getAttribute("href");
  assert.ok(href.startsWith("https://wa.me/554299476786?text="));
  const m = decodeMsg(href);
  for (const parte of ["Olá, Camily!", "Plano: Claro Pós 80GB", "Linhas: 2", "Hoje pago: R$ 300,00 por mês (Vivo)", "Mensalidade estimada na Claro: R$ 109,98", "Economia estimada em 24 meses: R$ 4.560,48", "manter os números", "CPF para CNPJ", "confirmar as condições comerciais"]) {
    assert.ok(m.includes(parte), `faltou: ${parte}\n${m}`);
  }
  assert.match(await txt(page, "#resultado"), /Sujeito à análise de elegibilidade e de crédito/);
  await ctx.close();
});
await teste("entradas inválidas mostram erro e não calculam", async () => {
  const { page, ctx } = await abrir("");
  await simular(page, { linhas: 0, valor: "100", plano: "pos-20" });
  assert.match(await txt(page, "#erro-simulador"), /1 a 500 linhas/);
  assert.equal(await page.locator("#resultado").isVisible(), false);
  await simular(page, { linhas: 2, valor: "", plano: "pos-20" });
  assert.match(await txt(page, "#erro-simulador"), /valor mensal atual/);
  await ctx.close();
});

console.log("\n== Benefícios, cobertura, depoimentos e FAQ ==");
await teste("Wellhub aparece como desconto de parceiro, até 40%, e M365 como contratação adicional", async () => {
  const { page, ctx } = await abrir("");
  await page.click('#abas-beneficios [data-cat="vantagens"]');
  const t = await txt(page, "#lista-beneficios");
  assert.match(t, /Wellhub.*Desconto de parceiro.*Até 40% de desconto/);
  assert.match(t, /Desconto de parceiro, não é gratuito/);
  await page.click('#abas-beneficios [data-cat="todos"]');
  assert.match(await txt(page, "#lista-beneficios"), /Microsoft 365 Contratação adicional/);
  await ctx.close();
});
await teste("cobertura: valida CEP, não inventa resultado e envia o endereço por WhatsApp", async () => {
  const { page, ctx } = await abrir("kauan/");
  await page.fill("#c-cep", "840");
  await page.click("#cobertura-form button");
  assert.match(await txt(page, "#erro-cobertura"), /CEP com 8 números/);
  await page.fill("#c-cep", "84010123");
  assert.equal(await page.inputValue("#c-cep"), "84010-123");
  await page.fill("#c-numero", "250"); await page.fill("#c-compl", "sala 3");
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.click("#cobertura-form button")]);
  const url = popup.url();
  assert.ok(url.startsWith("https://wa.me/554298484317?text=") || url.includes("wa.me/554298484317"), url);
  const m = decodeURIComponent(url);
  for (const p of ["CEP: 84010-123", "Número: 250", "Complemento: sala 3"]) assert.ok(m.includes(p), p);
  assert.ok(!/cobertura confirmada|disponível no seu endereço/i.test(await page.locator("#cobertura").innerText()));
  await ctx.close();
});
await teste("depoimentos: sem nenhum autorizado, a seção fica oculta", async () => {
  const { page, ctx } = await abrir("");
  assert.equal(await page.locator("#depoimentos").isVisible(), false);
  await ctx.close();
});
await teste("FAQ tem as perguntas pedidas e abre/fecha", async () => {
  const { page, ctx } = await abrir("");
  const n = await page.locator("#duvidas details").count();
  assert.ok(n >= 8, `só ${n}`);
  await page.click("#duvidas summary >> nth=0");
  assert.equal(await page.locator("#duvidas details").first().getAttribute("open"), "");
  const t = await page.locator("#duvidas").textContent();
  for (const k of ["portabilidade", "transferência", "fidelidade", "MEI", "bônus", "cobertura", "contrato", "atendimento"]) assert.ok(new RegExp(k, "i").test(t), k);
  await ctx.close();
});

console.log("\n== App na tela inicial (PWA) e vídeo ==");
for (const c of CONSULTORES.slice(0, 3)) {
  await teste(`${c.nome}: manifest, ícones e service worker`, async () => {
    const { page, ctx } = await abrir(c.pasta);
    const href = await page.locator('link[rel=manifest]').getAttribute("href");
    const resp = await page.request.get(new URL(href, page.url()).href);
    assert.equal(resp.status(), 200);
    const m = await resp.json();
    assert.equal(m.name, "Claro Empresas | Consultoria");
    assert.equal(m.display, "standalone");
    for (const ic of m.icons) assert.equal((await page.request.get(new URL(ic.src, new URL(href, page.url())).href)).status(), 200, ic.src);
    const escopo = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    assert.equal(escopo, BASE + "/", escopo);
    await ctx.close();
  });
}
await teste("seção de instalação: passos Android/iPhone, vídeo com controles e sem autoplay", async () => {
  const { page, ctx } = await abrir("");
  assert.match(await txt(page, "#instalar h2"), /Seu atendimento empresarial na palma da mão\./);
  assert.match(await txt(page, "#instalar .intro"), /Adicione nosso site à tela inicial do seu celular/);
  assert.match(await txt(page, "#passos-android"), /Instalar app/);
  await page.click("#aba-iphone");
  assert.match(await txt(page, "#passos-iphone"), /Adicionar à Tela de Início/);
  assert.equal(await page.locator("#passos-android").isVisible(), false);
  const v = page.locator("#instalar video");
  assert.equal(await v.getAttribute("preload"), "none");
  assert.equal(await v.getAttribute("autoplay"), null);
  assert.equal(await v.getAttribute("controls"), "");
  const src = await page.locator("#instalar video source").getAttribute("src");
  assert.equal((await page.request.fetch(new URL(src, page.url()).href, { method: "HEAD" })).status(), 200);
  assert.equal((await page.request.get(new URL(await v.getAttribute("poster"), page.url()).href)).status(), 200);
  assert.match(await txt(page, "#video-legenda"), /não é o aplicativo oficial|Minha Claro Empresas, da Claro, como exemplo/);
  assert.match(await txt(page, "#instalar .nota"), /não o aplicativo oficial da Claro/);
  const meta = await page.evaluate(() => ({ r: document.documentElement.scrollWidth <= innerWidth }));
  assert.ok(meta.r);
  await ctx.close();
});
await teste("iPhone abre direto na aba iPhone", async () => {
  const ctx = await navegador.newContext({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1", viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route(/fonts\./, (r) => r.abort());
  await page.goto(BASE + "/");
  await page.waitForFunction(() => document.documentElement.dataset.pronto === "1");
  assert.equal(await page.getAttribute("#aba-iphone", "aria-selected"), "true");
  await ctx.close();
});
await teste("navegador interno do WhatsApp/Instagram mostra o aviso", async () => {
  const ctx = await navegador.newContext({ userAgent: "Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 Instagram 300.0", viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route(/fonts\./, (r) => r.abort());
  await page.goto(BASE + "/");
  await page.waitForFunction(() => document.documentElement.dataset.pronto === "1");
  assert.equal(await page.locator("#aviso-navegador").isVisible(), true);
  await ctx.close();
});

console.log("\n== Teclado e menu ==");
await teste("primeiro Tab leva ao link 'Pular para o conteúdo'; setas trocam as abas", async () => {
  const { page, ctx } = await abrir("", 1280, 800);
  await page.keyboard.press("Tab");
  assert.match(await page.evaluate(() => document.activeElement.textContent), /Pular para o conteúdo/);
  await page.focus("#aba-movel");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.getAttribute("#aba-fibra", "aria-selected"), "true");
  assert.equal(await page.evaluate(() => document.activeElement.id), "aba-fibra");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.getAttribute("#aba-movel", "aria-selected"), "true");
  await ctx.close();
});
await teste("menu mobile abre, navega e fecha com Esc", async () => {
  const { page, ctx } = await abrir("", 375, 800);
  assert.equal(await page.locator("#menu").isVisible(), false);
  await page.click(".topo__menu");
  assert.equal(await page.getAttribute(".topo__menu", "aria-expanded"), "true");
  assert.equal(await page.locator("#menu").isVisible(), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#menu").isVisible(), false);
  await page.click(".topo__menu");
  await page.click('#menu a[href="#economizar"]');
  assert.equal(await page.locator("#menu").isVisible(), false);
  await ctx.close();
});
await teste("movimento reduzido: sem animações", async () => {
  const ctx = await navegador.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route(/fonts\./, (r) => r.abort());
  await page.goto(BASE + "/");
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), "auto");
  await ctx.close();
});

console.log("\n== Acessibilidade (axe-core, regras WCAG 2.x A/AA) ==");
import { readFileSync } from "node:fs";
let axeSrc = null;
try { axeSrc = readFileSync(process.env.AXE || "node_modules/axe-core/axe.min.js", "utf8"); } catch { console.log("  (axe-core não instalado: rode `npm i --no-save axe-core` ou use AXE=<caminho>/axe.min.js)"); }
for (const [rotulo, largura] of axeSrc ? [["celular 390px", 390], ["desktop 1280px", 1280]] : []) {
  await teste(`sem violações sérias ou críticas (${rotulo})`, async () => {
    const { page, ctx } = await abrir("", largura, 900);
    // abre o que fica escondido para auditar tudo
    await page.click("#aba-combo");
    await page.check("#cmp-combo-600-20"); await page.check("#cmp-combo-600-80");
    await simular(page, { linhas: 2, valor: "300", plano: "pos-80", fibra: "fibra-600" });
    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    await page.addScriptTag({ content: axeSrc });
    const r = await page.evaluate(() => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } }));
    const graves = r.violations.filter((v) => ["serious", "critical"].includes(v.impact));
    assert.deepEqual(graves.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes[0].target}`), []);
    if (r.violations.length) console.log("        avisos menores:", r.violations.map((v) => `${v.id}[${v.impact}]`).join(", "));
    await ctx.close();
  });
}

await navegador.close();
console.log(`\n${total - falhas}/${total} testes passaram${falhas ? `, ${falhas} FALHARAM` : ""}`);
process.exit(falhas ? 1 : 0);
