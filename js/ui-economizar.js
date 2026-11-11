import { el, icone, $ } from "./dom.js";
import { brl, emCentavos, lerValor } from "./formatar.js";
import { porCategoria } from "./catalogo.js";
import { simularFaixa, ErroSimulacao } from "./simulador.js";
import { linkWhats, msgSimulacao } from "./whatsapp.js";

// "entre R$ 600,00 e R$ 780,00", ou "de custo adicional ... a economia ..." quando os dois lados diferem em sinal
function textoFaixa(a, b) {
  if (a === b) return brl(Math.abs(a));
  if (a >= 0 && b >= 0) return `${brl(a)} a ${brl(b)}`;
  if (a < 0 && b < 0) return `${brl(-b)} a ${brl(-a)}`;
  return `${brl(-a)} a mais, até ${brl(b)} a menos`;
}

export function iniciarEconomizar(estado) {
  const { catalogo, consultor } = estado;
  const selPlano = $("#s-plano");
  for (const p of porCategoria(catalogo, "movel")) {
    selPlano.append(el("option", { value: p.id, texto: `${p.nome} – ${brl(emCentavos(p.valorMensal))}/mês por linha` }));
  }
  selPlano.value = "pos-80";
  const selFibra = $("#s-fibra");
  for (const f of porCategoria(catalogo, "fibra")) {
    const preco = f.promocao ? `${brl(emCentavos(f.valorMensal))} na promoção` : brl(emCentavos(f.valorMensal));
    selFibra.append(el("option", { value: f.id, texto: `${f.nome} – ${preco}` }));
  }

  function irAoPasso(n) {
    $("#e-passo1").hidden = n !== 1;
    $("#e-passo2").hidden = n !== 2;
    $("#e-passo3").hidden = n !== 3;
    $("#simulador").hidden = n === 3;
    $("#e-passo-texto").textContent = `Passo ${n} de 3`;
    $("#e-barra").style.width = `${(n / 3) * 100}%`;
    const alvo = $(`#e-passo${n} h2`) || $("#resultado h2");
    if (alvo) { alvo.setAttribute("tabindex", "-1"); alvo.focus(); }
  }
  function mostrarErro(msg) { const e = $("#erro-simulador"); e.textContent = msg; e.hidden = !msg; }
  function entrada() {
    return { linhas: Number($("#s-linhas").value), valorAtualMensal: lerValor($("#s-valor").value), planoId: selPlano.value, fibraId: selFibra.value || null };
  }

  $("#e-continuar").addEventListener("click", () => {
    mostrarErro("");
    const { linhas, valorAtualMensal } = entrada();
    if (!Number.isInteger(linhas) || linhas < 1 || linhas > 500) return mostrarErro("Informe de 1 a 500 linhas.");
    if (!Number.isFinite(valorAtualMensal) || valorAtualMensal < 0) return mostrarErro("Informe o valor mensal atual.");
    irAoPasso(2);
  });
  $("#e-voltar").addEventListener("click", () => irAoPasso(1));
  $("#e-refazer").addEventListener("click", () => irAoPasso(1));

  $("#simulador").addEventListener("submit", (e) => {
    e.preventDefault();
    mostrarErro("");
    let faixa;
    try { faixa = simularFaixa(catalogo, entrada()); }
    catch (err) { if (err instanceof ErroSimulacao) { irAoPasso(1); return mostrarErro(err.message); } throw err; }
    mostrar(faixa, Number($("input[name=periodo]:checked").value));
    irAoPasso(3);
  });

  function mostrar(faixa, meses) {
    const per = (s) => (meses === 12 ? s.p12 : s.p24);
    const a = per(faixa.pior).economia, b = per(faixa.melhor).economia;
    const economiza = faixa.variavel ? b >= 0 && a >= 0 : a >= 0;
    const mistura = faixa.variavel && a < 0 && b >= 0;
    const base = faixa.base;
    const plano = catalogo.find((p) => p.id === selPlano.value);
    const fibra = catalogo.find((p) => p.id === selFibra.value);
    const composicao = base.itens.map((i) => `${i.qtd} × ${i.nome}`).join(" + ");

    const rotulo = mistura ? `Resultado estimado em ${meses} meses` : `${economiza ? "Economia estimada" : "Custo adicional estimado"} em ${meses} meses`;
    const valor = faixa.variavel ? textoFaixa(a, b) : brl(Math.abs(a));
    const linhasDl = [["Você paga hoje", `${brl(base.valorAtualMensal)}/mês`]];
    if (faixa.variavel) {
      linhasDl.push(["Mensalidade durante a promoção", `${brl(faixa.melhor.novoValorPrimeiroMes)}/mês`]);
      linhasDl.push(["Mensalidade depois da promoção", `${brl(faixa.melhor.novoValorDepoisDaPromocao)}/mês`]);
    } else if (base.temPromocao) {
      linhasDl.push([`Mensalidade nos primeiros ${base.mesesDePromocao} meses`, `${brl(base.novoValorPrimeiroMes)}/mês`]);
      linhasDl.push(["Mensalidade depois da promoção", `${brl(base.novoValorDepoisDaPromocao)}/mês`]);
    } else {
      linhasDl.push(["Mensalidade na Claro", `${brl(base.novoValorPrimeiroMes)}/mês`]);
    }
    for (const m of [12, 24]) {
      const x = (m === 12 ? faixa.pior.p12 : faixa.pior.p24).economia, y = (m === 12 ? faixa.melhor.p12 : faixa.melhor.p24).economia;
      const s = faixa.variavel ? textoFaixa(x, y) : brl(Math.abs(x));
      linhasDl.push([`${(faixa.variavel ? y : x) >= 0 ? "Economia" : "Custo adicional"} em ${m} meses`, s]);
    }

    const whats = linkWhats(consultor.whatsapp, msgSimulacao(consultor, {
      faixa, meses, planoNome: plano.nome, linhas: Number($("#s-linhas").value),
      manterNumeros: $("#s-manter").checked, migrarCnpj: $("#s-cnpj").checked,
      fibraNome: fibra ? fibra.nome : "", operadora: $("#s-operadora").value,
    }));

    $("#resultado").replaceChildren(
      el("h2", { texto: "Sua simulação" }),
      el("div", { classe: "resultado__grande" + (economiza ? "" : " resultado__grande--custo") }, [el("small", { texto: rotulo }), el("b", { texto: valor })]),
      faixa.variavel ? el("p", { classe: "nota", texto: "A promoção da internet dura de 0 a 6 meses, conforme a região. Os dois extremos estão na faixa acima. Eu confirmo o valor certo na sua proposta." }) : null,
      el("dl", {}, linhasDl.flatMap(([t, v]) => [el("dt", { texto: t }), el("dd", { texto: v })])),
      el("ul", {}, [
        el("li", { texto: `Considerado: ${composicao}.` }),
        el("li", { texto: "Custo atual = o que você paga por mês × meses. Custo Claro = a soma do valor de cada mês, com a promoção só pelo tempo em que ela vale." }),
        !economiza && !mistura ? el("li", { texto: "Neste cenário o plano escolhido custa mais do que você paga hoje. Posso sugerir um plano menor." }) : null,
      ]),
      el("a", { classe: "botao botao--whats", target: "_blank", rel: "noopener", href: whats }, [icone("i-whats"), "Receber minha proposta personalizada"]),
      el("p", { classe: "ressalva", texto: "Estimativa. Valores no boleto, por mês. Sujeito à análise de elegibilidade e de crédito, a tributos e a custos que não foram informados. As condições finais são confirmadas no atendimento." }),
    );
  }

  irAoPasso(1);
  return { reiniciar: () => irAoPasso(1) };
}
