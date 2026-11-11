import { el, icone, $, $$ } from "./dom.js";
import { brl, emCentavos, lerValor } from "./formatar.js";
import { porCategoria } from "./catalogo.js";
import { simular, ErroSimulacao } from "./simulador.js";
import { linkWhats, msgSimulacao } from "./whatsapp.js";

export function iniciarEconomizar(estado) {
  const { catalogo, consultor } = estado;

  const selPlano = $("#s-plano");
  for (const p of porCategoria(catalogo, "movel")) {
    selPlano.append(el("option", { value: p.id, texto: `${p.nome} – ${brl(emCentavos(p.valorMensal))}/mês por linha` }));
  }
  selPlano.value = "pos-80";
  const selFibra = $("#s-fibra");
  for (const f of porCategoria(catalogo, "fibra")) {
    const promo = f.promocao ? `${brl(emCentavos(f.valorMensal))} por ${f.promocao.meses} meses` : brl(emCentavos(f.valorMensal));
    selFibra.append(el("option", { value: f.id, texto: `${f.nome} – ${promo}` }));
  }

  const form = $("#simulador");
  let calculou = false;

  function mostrarErro(msg) {
    const e = $("#erro-simulador");
    e.textContent = msg;
    e.hidden = !msg;
  }

  function calcular() {
    mostrarErro("");
    const linhas = Number($("#s-linhas").value);
    const valor = lerValor($("#s-valor").value);
    const meses = Number($("input[name=periodo]:checked").value);
    let sim;
    try {
      sim = simular(catalogo, { linhas, valorAtualMensal: valor, planoId: selPlano.value, fibraId: selFibra.value || null });
    } catch (e) {
      if (e instanceof ErroSimulacao) { $("#resultado").hidden = true; mostrarErro(e.message); return; }
      throw e;
    }
    mostrar(sim, meses);
  }

  function mostrar(sim, meses) {
    const per = meses === 12 ? sim.p12 : sim.p24;
    const economiza = per.economia >= 0;
    const plano = catalogo.find((p) => p.id === selPlano.value);
    const fibra = catalogo.find((p) => p.id === selFibra.value);
    const composicao = sim.itens.map((i) => `${i.qtd} × ${i.nome}`).join(" + ");

    const linhasDl = [
      ["Você paga hoje", `${brl(sim.valorAtualMensal)}/mês`],
      [sim.temPromocao ? `Novo valor nos primeiros ${sim.mesesDePromocao} meses` : "Novo valor estimado", `${brl(sim.novoValorPrimeiroMes)}/mês`],
    ];
    if (sim.temPromocao) linhasDl.push(["Novo valor depois da promoção", `${brl(sim.novoValorDepoisDaPromocao)}/mês`]);
    linhasDl.push([sim.diferencaMensalPrimeiroMes >= 0 ? "Diferença no 1º mês (a seu favor)" : "Diferença no 1º mês (a mais)", brl(Math.abs(sim.diferencaMensalPrimeiroMes))]);
    if (sim.temPromocao) linhasDl.push([sim.diferencaMensalDepois >= 0 ? "Diferença depois da promoção (a seu favor)" : "Diferença depois da promoção (a mais)", brl(Math.abs(sim.diferencaMensalDepois))]);
    for (const p of [sim.p12, sim.p24]) {
      linhasDl.push([`${p.economia >= 0 ? "Economia" : "Custo adicional"} em ${p.meses} meses`, brl(Math.abs(p.economia))]);
    }

    const whats = linkWhats(consultor.whatsapp, msgSimulacao(consultor, {
      sim, periodo: per, planoNome: plano.nome, linhas: Number($("#s-linhas").value),
      manterNumeros: $("#s-manter").checked, migrarCnpj: $("#s-cnpj").checked,
      fibraNome: fibra ? fibra.nome : "", operadora: $("#s-operadora").value,
    }));

    const r = $("#resultado");
    r.replaceChildren(
      el("h3", { texto: "Sua simulação" }),
      el("div", { classe: "resultado__grande" + (economiza ? "" : " resultado__grande--custo") }, [
        el("small", { texto: `${economiza ? "Economia estimada" : "Custo adicional estimado"} em ${per.meses} meses` }),
        el("b", { texto: brl(Math.abs(per.economia)) }),
      ]),
      el("dl", {}, linhasDl.flatMap(([t, v]) => [el("dt", { texto: t }), el("dd", { texto: v })])),
      el("ul", {}, [
        el("li", { texto: `Considerado: ${composicao}.` }),
        el("li", { texto: `Custo atual no período = ${brl(sim.valorAtualMensal)} × ${per.meses} meses = ${brl(per.custoAtual)}.` }),
        el("li", { texto: `Custo Claro no período = soma do valor previsto de cada mês${sim.temPromocao ? `, com a promoção de ${sim.mesesDePromocao} meses` : ""} = ${brl(per.custoClaro)}.` }),
        !economiza ? el("li", { texto: "Neste cenário o plano escolhido custa mais do que você paga hoje. Posso sugerir um plano menor." }) : null,
      ]),
      el("a", { classe: "botao botao--whats", target: "_blank", rel: "noopener", href: whats }, [icone("i-whats"), "Receber minha proposta personalizada"]),
      el("p", { classe: "ressalva", texto: "Estimativa. Valores no boleto, por mês. Sujeito à análise de elegibilidade e de crédito, a tributos e a custos que não foram informados. As condições finais são confirmadas no atendimento." }),
    );
    r.hidden = false;
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); calculou = true; calcular(); });
  // depois do primeiro cálculo, atualiza ao mudar qualquer campo
  form.addEventListener("change", () => { if (calculou) calcular(); });
}
