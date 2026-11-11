// Testes de ponta a ponta no navegador. Precisam do site servido em http://127.0.0.1:8765
//   (cd <repo> && python3 -m http.server 8765 --bind 127.0.0.1)   e   node tests/e2e.js
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
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
async function abrir(url, largura = 390, altura = 844, { animar = false } = {}) {
  // Nos testes o movimento fica reduzido (conteúdo sempre visível); o teste do efeito de aparecer liga a animação.
  const ctx = await navegador.newContext({ viewport: { width: largura, height: altura }, deviceScaleFactor: 1, serviceWorkers: "allow", reducedMotion: animar ? "no-preference" : "reduce" });
  await ctx.route(/wa\.me/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "ok" }));
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push("js: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)|Failed to load resource: net::ERR_FAILED/.test(m.text())) erros.push("console: " + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());   // sem internet para fontes no teste
  await page.goto(BASE + "/" + url);
  await page.waitForFunction(() => document.documentElement.dataset.pronto === "1", null, { timeout: 8000 });
  return { page, ctx, erros };
}
const txt = async (page, sel) => (await page.locator(sel).innerText()).replace(/\s+/g, " ").trim();
const decodeMsg = (href) => decodeURIComponent(href.split("text=")[1] || "");


console.log("\n== Páginas dos 4 consultores ==");
for (const c of CONSULTORES) {
  await teste(`${c.nome}: sem erros e todo botão de WhatsApp usa o próprio número`, async () => {
    const { page, ctx, erros } = await abrir(c.pasta);
    const hrefs = new Set();
    const colher = async () => (await page.$$eval("a[href*='wa.me']", (as) => as.map((a) => a.href))).forEach((x) => hrefs.add(x));
    await colher();
    for (const aba of ["movel", "fibra", "combo", "solucao"]) { await page.click(`#aba-${aba}`); await colher(); }
    assert.deepEqual(erros, []);
    assert.ok(hrefs.size >= 30, `só ${hrefs.size} links de WhatsApp diferentes`);
    assert.deepEqual([...hrefs].filter((h) => !h.startsWith(`https://wa.me/${c.numero}?text=`)), []);
    assert.ok((await page.title()).includes(c.nome));
    await ctx.close();
  });
}

console.log("\n== Responsividade (sem rolagem horizontal) ==");
for (const largura of [320, 375, 390, 768, 1024, 1440]) {
  await teste(`largura ${largura}px, com todas as abas, comparação e resultado abertos`, async () => {
    const { page, ctx } = await abrir("", largura, 800);
    const checar = async (onde) => {
      const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      assert.ok(w[0] <= w[1], `${onde}: scrollWidth ${w[0]} > ${w[1]}`);
    };
    await checar("início");
    for (const aba of ["fibra", "combo", "solucao", "movel"]) { await page.click(`#aba-${aba}`); await checar(aba); }
    await page.click("label[for=cmp-pos-20]"); await page.click("label[for=cmp-pos-80]"); await checar("comparação");
    await page.fill("#s-valor", "350"); await page.selectOption("#s-fibra", "fibra-600"); await page.click('#simulador button[type=submit]'); await checar("resultado");
    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true))); await checar("detalhes abertos");
    await ctx.close();
  });
}

console.log("\n== Uma página só, rolando ==");
await teste("tudo está na mesma página, em ordem, e visível (nada escondido atrás de menu ou passos)", async () => {
  const { page, ctx } = await abrir("");
  const ids = ["inicio", "contratar", "comparar", "economizar", "beneficios", "cobertura", "instalar", "duvidas"];
  let anterior = -1;
  for (const id of ids) {
    assert.equal(await page.locator(`#${id}`).isVisible(), true, id);
    const topo = await page.evaluate((i) => document.getElementById(i).getBoundingClientRect().top + scrollY, id);
    assert.ok(topo > anterior, `${id} fora de ordem`);
    anterior = topo;
  }
  assert.match(await txt(page, "#inicio h1"), /Planos Claro para a sua empresa/);
  assert.equal(await page.locator(".jornada").count(), 2);
  assert.equal(await page.locator("#lista-planos .cartao").count(), 6);
  assert.equal(await page.locator("#depoimentos").isVisible(), false);
  await ctx.close();
});
await teste("menu rola até cada seção e destaca a seção atual", async () => {
  const { page, ctx } = await abrir("", 1280, 800);
  for (const id of ["contratar", "comparar", "economizar", "beneficios", "cobertura", "instalar", "duvidas"]) {
    await page.click(`#menu a[href="#${id}"]`);
    await page.waitForFunction((i) => Math.abs(document.getElementById(i).getBoundingClientRect().top - 84) < 260, id, { timeout: 5000 });
    await page.waitForSelector(`#menu a[href="#${id}"][aria-current="true"]`, { timeout: 5000 });
  }
  await ctx.close();
});
await teste("jornadas do início levam a Contratar e a Economizar", async () => {
  const { page, ctx } = await abrir("");
  await page.click(".jornada >> nth=1");
  await page.waitForFunction(() => Math.abs(document.getElementById("economizar").getBoundingClientRect().top - 84) < 260);
  await page.evaluate(() => scrollTo(0, 0));
  await page.click(".jornada >> nth=0");
  await page.waitForFunction(() => Math.abs(document.getElementById("contratar").getBoundingClientRect().top - 84) < 260);
  await ctx.close();
});
await teste("efeito de aparecer ao rolar: seção abaixo da tela entra suave; com movimento reduzido já está visível", async () => {
  const { page, ctx } = await abrir("", 390, 700, { animar: true });
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("js-revela")), true);
  const op = (sel) => page.evaluate((s) => getComputedStyle(document.querySelector(s)).opacity, sel);
  assert.equal(await op("#cobertura .secao__cabeca"), "0");            // ainda não chegou lá
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#inicio h1")).opacity === "1", null, { timeout: 4000 });   // topo já visível
  await page.evaluate(() => document.getElementById("cobertura").scrollIntoView());
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#cobertura .secao__cabeca")).opacity === "1", null, { timeout: 4000 });
  await ctx.close();
  const r = await abrir("", 390, 700);
  assert.equal(await r.page.evaluate(() => document.documentElement.classList.contains("js-revela")), false);
  assert.equal(await r.page.evaluate(() => getComputedStyle(document.querySelector("#cobertura .secao__cabeca")).opacity), "1");
  await r.ctx.close();
});

await teste("trava de segurança: se o JavaScript do site falhar, o conteúdo não fica escondido", async () => {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 700 }, reducedMotion: "no-preference" });
  await ctx.route(/\/js\/app\.js/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.route(/fonts\./, (r) => r.abort());
  await page.goto(BASE + "/");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#cobertura .secao__cabeca")).opacity), "0");
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#cobertura .secao__cabeca")).opacity === "1", null, { timeout: 7000 });
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("js-revela")), false);
  await ctx.close();
});

console.log("\n== Contratar ==");
await teste("abas: celular, internet, combos e soluções, com a quantidade certa de planos", async () => {
  const { page, ctx } = await abrir("");
  const esperado = { movel: 6, fibra: 4, combo: 15, solucao: 3 };
  for (const [aba, n] of Object.entries(esperado)) {
    await page.click(`#aba-${aba}`);
    assert.equal(await page.getAttribute(`#aba-${aba}`, "aria-selected"), "true");
    assert.equal(await page.locator("#lista-planos .cartao").count(), n, aba);
  }
  assert.match(await txt(page, "#lista-planos"), /Sob consulta/);
  await ctx.close();
});
await teste("cartão mostra só o essencial; detalhes aparecem em ‘Ver detalhes’", async () => {
  const { page, ctx } = await abrir("");
  const c = page.locator('article[data-id="pos-80"]');
  const antes = await c.innerText();
  assert.match(antes, /80\s*GB/); assert.match(antes, /R\$ 54,99/); assert.match(antes, /Quero este plano/);
  assert.ok(!/Fidelidade|Gestor Online|McAfee/.test(antes), "detalhes não deveriam aparecer fechados");
  await c.locator("summary").click();
  const depois = await c.innerText();
  assert.match(depois, /Fidelidade: 24 meses/); assert.match(depois, /Gestor Online/); assert.match(depois, /25GB do plano \+ 55GB de bônus = 80GB/);
  await ctx.close();
});
await teste("preços do Claro Pós como no book", async () => {
  const { page, ctx } = await abrir("");
  const t = await txt(page, "#lista-planos");
  for (const v of ["R$ 34,99", "R$ 44,99", "R$ 54,99", "R$ 74,99", "R$ 89,99", "R$ 149,99"]) assert.ok(t.includes(v), v);
  assert.ok(!t.includes("R$ 29,99") && !t.includes("R$ 39,99"));
  await ctx.close();
});
await teste("filtros: perfil de uso, faixa de preço, internet mínima, ordem e linhas", async () => {
  const { page, ctx } = await abrir("");
  await page.click("#mais-filtros summary");
  await page.click('#perfis button:has-text("Viaja a negócios")');
  assert.equal(await page.locator("#lista-planos .cartao").count(), 3);
  await page.click('#perfis button:has-text("Todos")');
  await page.selectOption("#f-faixa", "ate50");
  assert.equal(await page.locator("#lista-planos .cartao").count(), 2);
  await page.selectOption("#f-faixa", "todas");
  await page.selectOption("#f-gb", "100");
  assert.equal(await page.locator("#lista-planos .cartao").count(), 2);
  await page.selectOption("#f-gb", "0");
  await page.selectOption("#f-ordem", "internet");
  assert.match(await txt(page, "#lista-planos .cartao:first-child"), /150\s*GB/);
  await page.fill("#f-linhas", "3");
  assert.match(await txt(page, "#lista-planos"), /Para 3 linhas: R\$ 104,97\/mês/);
  await ctx.close();
});
await teste("a operação (portabilidade, CPF→CNPJ, linha nova) muda a mensagem do WhatsApp", async () => {
  const { page, ctx } = await abrir("kauan/");
  const href = () => page.locator('a[data-plano="pos-80"]').getAttribute("href");
  assert.match(decodeMsg(await href()), /^Olá, Kauan! Quero fazer portabilidade para o plano Claro Pós 80GB – R\$ 54,99\.$/);
  await page.click("label:has(input[value=transferencia])");
  assert.match(decodeMsg(await href()), /^Olá, Kauan! Quero transferir minha linha do CPF para o CNPJ no plano Claro Pós 80GB – R\$ 54,99\.$/);
  await page.click("label:has(input[value=linha-nova])");
  assert.match(decodeMsg(await href()), /linha nova no plano Claro Pós 80GB/);
  await page.click("#aba-fibra");
  assert.equal(await page.locator("#operacoes").isVisible(), false);
  await ctx.close();
});
await teste("internet 600 Mega: R$ 59,90 por até 6 meses (conforme a região) e depois R$ 99,90", async () => {
  const { page, ctx } = await abrir("");
  await page.click("#aba-fibra");
  const t = await txt(page, 'article[data-id="fibra-600"]');
  assert.match(t, /R\$ 59,90/);
  assert.match(t, /Por até 6 meses, conforme a região\. Depois, R\$ 99,90\/mês\./);
  assert.ok(!/por 3 meses/i.test(t));
  assert.match(decodeMsg(await page.locator('a[data-plano="fibra-600"]').getAttribute("href")), /R\$ 59,90 por até 6 meses\. O CEP da empresa é: $/);
  assert.ok(!/até 6 meses/.test(await txt(page, 'article[data-id="fibra-800"]')));
  assert.match(await txt(page, 'article[data-id="fibra-800"]'), /R\$ 99,90/);
  assert.match(await txt(page, 'article[data-id="fibra-1g"]'), /R\$ 179,90/);
  await ctx.close();
});
await teste("combos 600 Mega seguem a mesma regra; 800 Mega não tem promoção", async () => {
  const { page, ctx } = await abrir("");
  await page.click("#aba-combo");
  const c = await txt(page, 'article[data-id="combo-600-80"]');
  assert.match(c, /R\$ 114,89/); assert.match(c, /Por até 6 meses, conforme a região\. Depois, R\$ 144,89\/mês\./); assert.match(c, /50GB de Mega Bônus/);
  assert.ok(!/até 6 meses/.test(await txt(page, 'article[data-id="combo-800-80"]')));
  await ctx.close();
});
await teste("links antigos (#portabilidade, #transferencia, #linha-nova, #internet, #combo) abrem direto nos planos", async () => {
  for (const [hash, aba, esperado, op] of [["portabilidade", "movel", 6, "portabilidade"], ["transferencia", "movel", 6, "transferencia"], ["linha-nova", "movel", 6, "linha-nova"], ["internet", "fibra", 4], ["combo", "combo", 15]]) {
    const { page, ctx } = await abrir("#" + hash);
    assert.equal(await page.getAttribute(`#aba-${aba}`, "aria-selected"), "true", hash);
    assert.equal(await page.locator("#lista-planos .cartao").count(), esperado, hash);
    if (op) assert.ok(await page.isChecked(`input[value="${op}"]`), hash);
    await page.waitForFunction(() => Math.abs(document.getElementById("contratar").getBoundingClientRect().top) < 200, null, { timeout: 4000 });
    await ctx.close();
  }
});

console.log("\n== Comparador ==");
await teste("compara até 3, bloqueia o 4º e destaca diferenças", async () => {
  const { page, ctx } = await abrir("");
  assert.match(await txt(page, "#comparacao"), /Nenhum plano selecionado ainda/);
  await page.click("label[for=cmp-pos-20]"); await page.click("label[for=cmp-pos-80]");
  assert.equal(await page.locator("#bandeja").isVisible(), true);
  await page.click("label[for=cmp-pos-150]");
  assert.equal(await page.locator("#comparacao table").count(), 1);
  assert.ok((await page.locator("#comparacao tr.difere").count()) >= 4);
  const r = await txt(page, "#comparacao .recomendacoes");
  assert.match(r, /Menor mensalidade.*Claro Pós 20GB/i); assert.match(r, /Maior internet.*Claro Pós 150GB/i);
  assert.match(await txt(page, "#comparacao"), /não existe plano “melhor”/i);
  await page.click("label[for=cmp-pos-30]");   // 4º plano: recusado
  assert.equal(await page.isChecked("#cmp-pos-30"), false);
  assert.match(await page.locator("#aviso-comparar").textContent(), /até 3 planos/);
  await page.click("#bandeja-ver");
  await page.waitForSelector("#bandeja", { state: "hidden", timeout: 5000 });   // some quando a comparação está na tela
  await page.evaluate(() => document.getElementById("economizar").scrollIntoView());
  assert.equal(await page.locator("#bandeja").isVisible(), false);              // e não cobre o formulário
  await ctx.close();
});
await teste("categorias diferentes não se misturam", async () => {
  const { page, ctx } = await abrir("");
  await page.click("label[for=cmp-pos-20]");
  await page.click("#aba-fibra");
  await page.click("label[for=cmp-fibra-400]");
  assert.equal(await page.isChecked("#cmp-fibra-400"), false);
  assert.match(await page.locator("#aviso-comparar").textContent(), /mesma categoria/);
  await ctx.close();
});
await teste("remover da tabela e limpar", async () => {
  const { page, ctx } = await abrir("");
  await page.click("label[for=cmp-pos-20]"); await page.click("label[for=cmp-pos-30]");
  await page.click('button[aria-label="Remover Claro Pós 20GB da comparação"]');
  assert.match(await txt(page, "#comparacao"), /Você escolheu Claro Pós 30GB/);
  assert.equal(await page.isChecked("#cmp-pos-20"), false);
  await page.click("#comparar-limpar");                       // a bandeja some quando a comparação está na tela
  assert.equal(await page.locator("#bandeja").isVisible(), false);
  assert.match(await txt(page, "#comparacao"), /Nenhum plano selecionado ainda/);
  await page.click("label[for=cmp-pos-20]");
  await page.evaluate(() => document.getElementById("contratar").scrollIntoView());
  await page.waitForSelector("#bandeja", { state: "visible", timeout: 5000 });  // escolhendo planos, a bandeja volta
  await page.click("#bandeja-limpar");
  assert.equal(await page.locator("#bandeja").isVisible(), false);
  await ctx.close();
});

console.log("\n== Economizar: simulador ==");
async function simular(page, { linhas, valor, plano, fibra = "", periodo = "24" }) {
  await page.fill("#s-linhas", String(linhas));
  await page.fill("#s-valor", valor);
  await page.selectOption("#s-plano", plano);
  await page.selectOption("#s-fibra", fibra);
  await page.check(`input[name=periodo][value="${periodo}"]`);
  await page.click('#simulador button[type=submit]');
}
await teste("valida os campos antes de calcular", async () => {
  const { page, ctx } = await abrir("");
  assert.match(await txt(page, "#resultado"), /O resultado aparece aqui/);
  await simular(page, { linhas: 0, valor: "100", plano: "pos-20" });
  assert.match(await txt(page, "#erro-simulador"), /1 a 500 linhas/);
  await simular(page, { linhas: 2, valor: "", plano: "pos-20" });
  assert.match(await txt(page, "#erro-simulador"), /valor mensal atual/);
  assert.match(await txt(page, "#resultado"), /O resultado aparece aqui/);
  await ctx.close();
});
await teste("celular sem fibra: valor único (10 linhas de 80GB, 24 meses)", async () => {
  const { page, ctx } = await abrir("");
  await simular(page, { linhas: 10, valor: "700", plano: "pos-80" });
  const r = await txt(page, "#resultado");
  assert.match(r, /Economia estimada em 24 meses R\$ 3\.602,40/);
  assert.ok(!/0 a 6 meses/.test(r));
  await ctx.close();
});
await teste("600 Mega: faixa de 0 a 6 meses de promoção (24 e 12 meses), que acompanha as mudanças", async () => {
  const { page, ctx } = await abrir("kauan/");
  await simular(page, { linhas: 1, valor: "150,00", plano: "pos-20", fibra: "fibra-600" });
  let r = await txt(page, "#resultado");
  assert.match(r, /Economia estimada em 24 meses R\$ 602,64 a R\$ 782,64/);      // 3.600,00 − 2.997,36  e  3.600,00 − 2.817,36
  assert.match(r, /de 0 a 6 meses, conforme a região/);
  assert.match(r, /Mensalidade durante a promoção R\$ 94,89\/mês/);
  assert.match(r, /Mensalidade depois da promoção R\$ 124,89\/mês/);
  assert.match(r, /Economia em 12 meses R\$ 301,32 a R\$ 481,32/);             // 1.800,00 − 1.498,68  e  1.800,00 − 1.318,68
  assert.match(decodeMsg(await page.locator("#resultado a.botao--whats").getAttribute("href")), /economia de R\$ 602,64 \(sem promoção da internet\) a economia de R\$ 782,64 \(promoção de 6 meses\)/);
  await page.check('input[name=periodo][value="12"]');     // depois do 1º cálculo, atualiza sozinho
  assert.match(await txt(page, "#resultado"), /Economia estimada em 12 meses R\$ 301,32 a R\$ 481,32/);
  await ctx.close();
});
await teste("800 Mega com celular não tem promoção: valor único", async () => {
  const { page, ctx } = await abrir("");
  await simular(page, { linhas: 1, valor: "300", plano: "pos-80", fibra: "fibra-800" });
  const r = await txt(page, "#resultado");
  assert.ok(!/0 a 6 meses/.test(r));
  assert.match(r, /Mensalidade na Claro R\$ 154,89\/mês/);
  assert.match(r, /Economia estimada em 24 meses R\$ 3\.482,64/);               // 7.200,00 − 24 × 154,89
  await ctx.close();
});
await teste("aumento de custo aparece como custo adicional", async () => {
  const { page, ctx } = await abrir("");
  await simular(page, { linhas: 1, valor: "20", plano: "pos-150", periodo: "12" });
  const r = await txt(page, "#resultado");
  assert.match(r, /Custo adicional estimado em 12 meses R\$ 1\.559,88/);
  assert.match(r, /custa mais do que você paga hoje/);
  await ctx.close();
});
await teste("proposta por WhatsApp leva plano, linhas, mensalidade, economia e interesses", async () => {
  const { page, ctx } = await abrir("camily/");
  await page.click("label:has(#s-manter)"); await page.click("label:has(#s-cnpj)");
  await page.selectOption("#s-operadora", "Vivo");
  await simular(page, { linhas: 2, valor: "300", plano: "pos-80" });
  const href = await page.locator("#resultado a.botao--whats").getAttribute("href");
  assert.ok(href.startsWith("https://wa.me/554299476786?text="));
  const m = decodeMsg(href);
  for (const parte of ["Olá, Camily!", "Plano: Claro Pós 80GB", "Linhas: 2", "Hoje pago: R$ 300,00 por mês (Vivo)", "Mensalidade estimada na Claro: R$ 109,98", "Estimativa em 24 meses: economia de R$ 4.560,48.", "manter os números", "CPF para CNPJ", "confirmar as condições comerciais"]) {
    assert.ok(m.includes(parte), `faltou: ${parte}\n${m}`);
  }
  assert.match(await txt(page, "#resultado"), /Sujeito à análise de elegibilidade e de crédito/);
  await ctx.close();
});

console.log("\n== Benefícios, cobertura, depoimentos e dúvidas ==");
await teste("benefícios: Wellhub é desconto de parceiro (até 40%); M365 é contratação adicional", async () => {
  const { page, ctx } = await abrir("#beneficios");
  await page.click('#abas-beneficios [data-cat="vantagens"]');
  const w = page.locator(".beneficio", { hasText: "Wellhub" });
  assert.match(await w.innerText(), /Desconto de parceiro/); assert.match(await w.innerText(), /Até 40% de desconto/);
  assert.ok(!/não é gratuito/.test(await w.innerText()), "condições só aparecem ao abrir");
  await w.locator("summary").click();
  assert.match(await w.innerText(), /não é gratuito/);
  await page.click('#abas-beneficios [data-cat="todos"]');
  assert.match(await page.locator(".beneficio", { hasText: "Microsoft 365" }).innerText(), /Contratação adicional/);
  assert.match(await txt(page, ".legenda"), /Incluso no plano.*Desconto de parceiro.*Contratação adicional/);
  await ctx.close();
});
await teste("cobertura: valida o CEP, não inventa resultado e envia o endereço por WhatsApp", async () => {
  const { page, ctx } = await abrir("kauan/#cobertura");
  await page.fill("#c-cep", "840");
  await page.click("#cobertura-form button");
  assert.match(await txt(page, "#erro-cobertura"), /CEP com 8 números/);
  await page.fill("#c-cep", "84010123");
  assert.equal(await page.inputValue("#c-cep"), "84010-123");
  await page.fill("#c-numero", "250"); await page.fill("#c-compl", "sala 3");
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.click("#cobertura-form button")]);
  const m = decodeURIComponent(popup.url());
  assert.ok(m.includes("wa.me/554298484317"), m);
  for (const p of ["CEP: 84010-123", "Número: 250", "Complemento: sala 3"]) assert.ok(m.includes(p), p);
  assert.ok(!/cobertura confirmada|disponível no seu endereço/i.test(await page.locator("#cobertura").innerText()));
  await ctx.close();
});
await teste("depoimentos: sem nenhum autorizado, nada aparece", async () => {
  const { page, ctx } = await abrir("");
  assert.equal(await page.locator("#depoimentos").isVisible(), false);
  await ctx.close();
});
await teste("dúvidas: perguntas pedidas e abre/fecha", async () => {
  const { page, ctx } = await abrir("#duvidas");
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
    const href = await page.locator("link[rel=manifest]").getAttribute("href");
    const resp = await page.request.get(new URL(href, page.url()).href);
    assert.equal(resp.status(), 200);
    const m = await resp.json();
    assert.equal(m.name, "Claro Empresas | Consultoria"); assert.equal(m.display, "standalone");
    for (const ic of m.icons) assert.equal((await page.request.get(new URL(ic.src, new URL(href, page.url())).href)).status(), 200, ic.src);
    assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope), BASE + "/");
    await ctx.close();
  });
}
await teste("instalar: textos pedidos, passos Android/iPhone, vídeo com controles e sem autoplay", async () => {
  const { page, ctx } = await abrir("#instalar");
  assert.match(await txt(page, "#instalar h2"), /Seu atendimento empresarial na palma da mão\./);
  assert.match(await txt(page, "#instalar .intro"), /Adicione nosso site à tela inicial do seu celular/);
  assert.match(await txt(page, "#passos-android"), /Instalar app/);
  await page.click("#aba-iphone");
  assert.match(await txt(page, "#passos-iphone"), /Adicionar à Tela de Início/);
  assert.equal(await page.locator("#passos-android").isVisible(), false);
  const v = page.locator("#instalar video");
  assert.equal(await v.getAttribute("preload"), "none"); assert.equal(await v.getAttribute("autoplay"), null); assert.equal(await v.getAttribute("controls"), "");
  assert.equal((await page.request.fetch(new URL(await page.locator("#instalar video source").getAttribute("src"), page.url()).href, { method: "HEAD" })).status(), 200);
  assert.equal((await page.request.get(new URL(await v.getAttribute("poster"), page.url()).href)).status(), 200);
  assert.match(await txt(page, "#video-legenda"), /Minha Claro Empresas, da Claro, como exemplo/);
  assert.match(await txt(page, "#instalar .nota"), /não o aplicativo oficial da Claro/);
  await ctx.close();
});
await teste("iPhone abre na aba iPhone; navegador interno mostra o aviso", async () => {
  for (const [ua, esperado] of [["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1", "iphone"], ["Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 Instagram 300.0", "aviso"]]) {
    const ctx = await navegador.newContext({ userAgent: ua, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.route(/fonts\./, (r) => r.abort());
    await page.goto(BASE + "/#instalar");
    await page.waitForFunction(() => document.documentElement.dataset.pronto === "1");
    if (esperado === "iphone") assert.equal(await page.getAttribute("#aba-iphone", "aria-selected"), "true");
    else assert.equal(await page.locator("#aviso-navegador").isVisible(), true);
    await ctx.close();
  }
});

console.log("\n== Teclado, menu e movimento ==");
await teste("Tab: pular para o conteúdo primeiro; setas trocam as abas de serviço", async () => {
  const { page, ctx } = await abrir("", 1280, 800);
  await page.keyboard.press("Tab");
  assert.match(await page.evaluate(() => document.activeElement.textContent), /Pular para o conteúdo/);
  await page.focus("#aba-movel");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.getAttribute("#aba-fibra", "aria-selected"), "true");
  assert.equal(await page.evaluate(() => document.activeElement.id), "aba-fibra");
  assert.equal(await page.locator("#lista-planos .cartao").count(), 4);
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.getAttribute("#aba-movel", "aria-selected"), "true");
  await ctx.close();
});
await teste("portabilidade/CPF→CNPJ/linha nova funcionam pelo teclado", async () => {
  const { page, ctx } = await abrir("kauan/", 1280, 800);
  await page.focus('input[value="portabilidade"]');
  await page.keyboard.press("ArrowDown");
  assert.ok(await page.isChecked('input[value="transferencia"]'));
  assert.match(decodeMsg(await page.locator('a[data-plano="pos-20"]').getAttribute("href")), /do CPF para o CNPJ/);
  await ctx.close();
});
await teste("menu do celular abre, rola até a seção e fecha; Esc também fecha", async () => {
  const { page, ctx } = await abrir("", 375, 800);
  assert.equal(await page.locator("#menu").isVisible(), false);
  await page.click(".topo__menu");
  assert.equal(await page.getAttribute(".topo__menu", "aria-expanded"), "true");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#menu").isVisible(), false);
  await page.click(".topo__menu");
  await page.click('#menu a[href="#economizar"]');
  assert.equal(await page.locator("#menu").isVisible(), false);
  await page.waitForFunction(() => Math.abs(document.getElementById("economizar").getBoundingClientRect().top - 84) < 260);
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

console.log("\n== Acessibilidade (axe-core, WCAG 2.x A/AA) ==");
let axeSrc = null;
try { axeSrc = readFileSync(process.env.AXE || "node_modules/axe-core/axe.min.js", "utf8"); } catch { console.log("  (axe-core não instalado: rode `npm i --no-save axe-core` ou use AXE=<caminho>/axe.min.js)"); }
for (const [rotulo, largura] of axeSrc ? [["celular 390px", 390], ["desktop 1280px", 1280]] : []) {
  await teste(`página inteira, em cada aba e com comparação e resultado abertos (${rotulo})`, async () => {
    const { page, ctx } = await abrir("", largura, 900);
    const checar = async (nome) => {
      await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
      await page.addScriptTag({ content: axeSrc });
      const r = await page.evaluate(() => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } }));
      const graves = r.violations.filter((v) => ["serious", "critical"].includes(v.impact));
      assert.deepEqual(graves.map((v) => `${nome} → ${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes[0].target}`), []);
    };
    await checar("celular");
    for (const aba of ["fibra", "combo", "solucao"]) { await page.click(`#aba-${aba}`); await checar(aba); }
    await page.click("#aba-combo");
    await page.click("label[for=cmp-combo-600-20]"); await page.click("label[for=cmp-combo-600-80]");
    await page.click('#abas-beneficios [data-cat="vantagens"]');
    await simular(page, { linhas: 2, valor: "300", plano: "pos-80", fibra: "fibra-600" });
    await checar("comparação e resultado");
    await ctx.close();
  });
}

await navegador.close();
console.log(`\n${total - falhas}/${total} testes passaram${falhas ? `, ${falhas} FALHARAM` : ""}`);
process.exit(falhas ? 1 : 0);
