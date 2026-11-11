import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { simular, ErroSimulacao } from "../js/simulador.js";
import { precoNoMes } from "../js/catalogo.js";
import { brl, lerValor, mascaraCep, cepValido, emCentavos } from "../js/formatar.js";
import { podeAdicionar, linhasDaComparacao, recomendacoes } from "../js/comparador.js";
import { msgPlano, msgSimulacao, msgCobertura, linkWhats } from "../js/whatsapp.js";

const catalogo = JSON.parse(readFileSync(new URL("../fonte/planos.json", import.meta.url), "utf8"));
const por = (id) => catalogo.find((p) => p.id === id);
const consultor = { primeiroNome: "Kauan", whatsapp: "554298484317" };

test("preços do Claro Pós batem com o book de novembro (pág. 44)", () => {
  const esperado = { "pos-20": 34.99, "pos-30": 44.99, "pos-80": 54.99, "pos-70": 74.99, "pos-100": 89.99, "pos-150": 149.99 };
  for (const [id, v] of Object.entries(esperado)) assert.equal(por(id).valorMensal, v, id);
});

test("franquia + bônus = internet total", () => {
  for (const p of catalogo.filter((x) => x.totalGB != null)) {
    assert.equal(p.franquiaGB + p.bonusGB + (p.megaBonusGB || 0), p.totalGB, p.id);
  }
});

test("combos = fibra com móvel + plano móvel (confere cada centavo do book)", () => {
  for (const c of catalogo.filter((x) => x.categoria === "combo")) {
    const f = por(c.componentes.fibra), m = por(c.componentes.movel);
    const depois = emCentavos(f.valorComMovel) + emCentavos(m.valorMensal);
    const primeiro = emCentavos((f.promocao ? f.valorMensal : f.valorComMovel)) + emCentavos(m.valorMensal);
    assert.equal(emCentavos(c.valorMensal), primeiro, `${c.id} mês 1`);
    if (f.promocao) assert.equal(emCentavos(c.promocao.valorDepois), depois, `${c.id} depois`);
    else assert.equal(c.promocao, null, c.id);
  }
});

test("promoção não é permanente: 600 Mega + 20GB", () => {
  const c = por("combo-600-20");
  assert.equal(precoNoMes(c, 1), 9489);
  assert.equal(precoNoMes(c, 3), 9489);
  assert.equal(precoNoMes(c, 4), 12489);
});

test("todo item publicável tem os campos obrigatórios", () => {
  for (const p of catalogo) {
    for (const campo of ["id", "nome", "categoria", "pagamento", "fidelidade", "restricoes", "grupoMercado", "dataReferencia", "aprovado", "fonte"]) {
      assert.ok(p[campo] !== undefined, `${p.id} sem ${campo}`);
    }
    assert.ok(p.fonte.pagina > 0, p.id);
  }
});

test("simulador: 10 linhas de 80GB por 24 meses (sem promoção)", () => {
  const r = simular(catalogo, { linhas: 10, valorAtualMensal: 700, planoId: "pos-80" });
  assert.equal(r.novoValorPrimeiroMes, 54990);
  assert.equal(r.p24.custoClaro, 5499 * 10 * 24);      // 13.197,60
  assert.equal(r.p24.custoAtual, 70000 * 24);          // 16.800,00
  assert.equal(r.p24.economia, 360240);                // 3.602,40
  assert.equal(r.p12.economia, 70000 * 12 - 5499 * 10 * 12);
  assert.equal(r.temPromocao, false);
});

test("simulador: combo com promoção de 3 meses não multiplica o preço promocional por 24", () => {
  const r = simular(catalogo, { linhas: 1, valorAtualMensal: 150, planoId: "pos-20", fibraId: "fibra-600" });
  assert.equal(r.combo, true);
  assert.equal(r.p12.custoClaro, 3 * 9489 + 9 * 12489);   // 1.408,68
  assert.equal(r.p24.custoClaro, 3 * 9489 + 21 * 12489);  // 2.907,36
  assert.equal(r.p24.economia, 15000 * 24 - (3 * 9489 + 21 * 12489)); // 692,64
  assert.equal(r.p24.economia, 69264);
  assert.equal(r.temPromocao, true);
  assert.equal(r.mesesDePromocao, 3);
  assert.equal(r.novoValorDepoisDaPromocao, 12489);
});

test("simulador: combo + linhas extras", () => {
  const r = simular(catalogo, { linhas: 3, valorAtualMensal: 400, planoId: "pos-80", fibraId: "fibra-800" });
  // combo 800+80 = 154,89 e mais 2 linhas de 54,99
  assert.equal(r.novoValorPrimeiroMes, 15489 + 2 * 5499);
  assert.equal(r.p12.custoClaro, 12 * (15489 + 2 * 5499));
});

test("simulador: aumento de custo aparece como valor negativo", () => {
  const r = simular(catalogo, { linhas: 1, valorAtualMensal: 20, planoId: "pos-150" });
  assert.ok(r.p12.economia < 0);
  assert.equal(r.p12.economia, 2000 * 12 - 14999 * 12);
});

test("simulador: valida entradas", () => {
  assert.throws(() => simular(catalogo, { linhas: 0, valorAtualMensal: 100, planoId: "pos-20" }), ErroSimulacao);
  assert.throws(() => simular(catalogo, { linhas: 2, valorAtualMensal: NaN, planoId: "pos-20" }), ErroSimulacao);
  assert.throws(() => simular(catalogo, { linhas: 2, valorAtualMensal: 100, planoId: "fibra-600" }), ErroSimulacao);
  assert.throws(() => simular(catalogo, { linhas: 1.5, valorAtualMensal: 100, planoId: "pos-20" }), ErroSimulacao);
});

test("formatação brasileira", () => {
  assert.equal(brl(5499), "R$ 54,99");
  assert.equal(brl(1319760), "R$ 13.197,60");
  assert.equal(lerValor("1.250,50"), 1250.5);
  assert.equal(lerValor("R$ 700"), 700);
  assert.equal(lerValor("1250.50"), 1250.5);
  assert.ok(Number.isNaN(lerValor("abc")));
  assert.equal(mascaraCep("84010123"), "84010-123");
  assert.ok(cepValido("84010-123"));
  assert.ok(!cepValido("8401"));
});

test("comparador: só compara a mesma categoria e até 3", () => {
  assert.equal(podeAdicionar([por("pos-20")], por("fibra-400")).ok, false);
  assert.equal(podeAdicionar([por("pos-20")], por("pos-20")).ok, false);
  assert.equal(podeAdicionar([por("pos-20"), por("pos-30"), por("pos-80")], por("pos-70")).ok, false);
  assert.equal(podeAdicionar([por("pos-20")], por("pos-30")).ok, true);
  assert.equal(podeAdicionar([], por("sol-m365")).ok, false);
});

test("comparador: marca as linhas que diferem", () => {
  const linhas = linhasDaComparacao([por("pos-70"), por("pos-100")]);
  assert.equal(linhas.find((l) => l.rotulo === "Mensalidade").difere, true);
  assert.equal(linhas.find((l) => l.rotulo === "Fidelidade").difere, false);
  const rec = recomendacoes([por("pos-20"), por("pos-80"), por("pos-150")]);
  assert.equal(rec[0].plano.id, "pos-20");   // menor mensalidade
  assert.equal(rec[1].plano.id, "pos-150");  // maior internet
  assert.equal(rec[2].plano.id, "pos-80");   // 54,99 / 80GB é o menor custo por GB
});

test("mensagens de WhatsApp levam o contexto certo", () => {
  assert.match(msgPlano(consultor, por("pos-80"), "portabilidade"), /portabilidade para o plano Claro Pós 80GB – R\$ 54,99/);
  assert.match(msgPlano(consultor, por("pos-20"), "transferencia"), /do CPF para o CNPJ/);
  assert.match(msgPlano(consultor, por("fibra-600")), /R\$ 59,90 por 3 meses/);
  assert.match(msgPlano(consultor, por("combo-600-80")), /CEP da empresa/);
  const sim = simular(catalogo, { linhas: 2, valorAtualMensal: 300, planoId: "pos-80" });
  const txt = msgSimulacao(consultor, { sim, periodo: sim.p24, planoNome: "Claro Pós 80GB", linhas: 2, manterNumeros: true, migrarCnpj: true, fibraNome: "", operadora: "Vivo" });
  assert.match(txt, /Linhas: 2/);
  assert.match(txt, /Hoje pago: R\$ 300,00 por mês \(Vivo\)/);
  assert.match(txt, /Economia estimada em 24 meses: R\$ 4\.560,48/);
  assert.match(txt, /manter os números, migrar da titularidade CPF para CNPJ/);
  assert.match(msgCobertura(consultor, { cep: "84010-123", numero: "10", complemento: "sala 2" }), /CEP: 84010-123/);
  assert.ok(linkWhats("554298484317", "oi").startsWith("https://wa.me/554298484317?text="));
});
