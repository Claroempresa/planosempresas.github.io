import { el, icone, $, $$, aviso } from "./dom.js";
import { brl, emCentavos } from "./formatar.js";
import { precoNoMes, porCategoria, filtrar, ordenar, PERFIS, ROTULO_CATEGORIA } from "./catalogo.js";
import { MAX_COMPARAR, podeAdicionar, linhasDaComparacao, recomendacoes } from "./comparador.js";
import { linkWhats, msgPlano, msgComparacao } from "./whatsapp.js";

const NOTAS_OPERACAO = {
  portabilidade: "Você traz o número de outra operadora para a Claro e continua com ele. Sujeito à análise de elegibilidade e de crédito.",
  transferencia: "A linha já é Claro e passa do seu CPF para o CNPJ da empresa, mantendo o número. Sujeito à análise de elegibilidade.",
  "linha-nova": "Linha nova no CNPJ da empresa. Sujeito à análise de crédito.",
};

// Quais filtros fazem sentido para cada serviço.
const FILTROS_POR_SERVICO = {
  movel: ["ordem", "faixa", "gb", "perfil", "linhas"],
  fibra: ["ordem", "faixa"],
  combo: ["ordem", "faixa", "gb", "perfil"],
  solucao: [],
};

export function iniciarContratar(estado) {
  const { catalogo, beneficios, consultor } = estado;
  const nomeBeneficio = (id) => beneficios.find((b) => b.id === id)?.nome ?? id;

  estado.servico = "movel";
  estado.operacao = "portabilidade";
  estado.comparados = [];

  // perfis de uso (regras transparentes ficam no próprio texto da opção)
  const selPerfil = $("#f-perfil");
  for (const [id, p] of Object.entries(PERFIS)) selPerfil.append(el("option", { value: id, texto: p.rotulo }));

  // ---------- abas de serviço ----------
  const abas = $$("#servicos [role=tab]");
  abas.forEach((aba, i) => {
    aba.addEventListener("click", () => abrirServico(aba.dataset.servico, { foco: false }));
    aba.addEventListener("keydown", (e) => {
      const passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!passo) return;
      e.preventDefault();
      const prox = abas[(i + passo + abas.length) % abas.length];
      abrirServico(prox.dataset.servico, { foco: true });
    });
  });

  function abrirServico(servico, { foco = false } = {}) {
    estado.servico = servico;
    abas.forEach((a) => {
      const sel = a.dataset.servico === servico;
      a.setAttribute("aria-selected", String(sel));
      a.tabIndex = sel ? 0 : -1;
      if (sel) {
        $("#painel-servico").setAttribute("aria-labelledby", a.id);
        if (foco) a.focus();
      }
    });
    $("#operacoes").hidden = servico !== "movel";
    $("#nota-operacao").hidden = servico !== "movel";
    const visiveis = FILTROS_POR_SERVICO[servico];
    const mapa = { ordem: "#f-ordem", faixa: "#f-faixa", gb: "#f-gb", perfil: "#f-perfil", linhas: "#f-linhas" };
    for (const [k, sel] of Object.entries(mapa)) $(sel).closest("label").hidden = !visiveis.includes(k);
    $("#filtros").hidden = visiveis.length === 0;
    renderizar();
  }

  // ---------- operação (portabilidade / CPF→CNPJ / linha nova) ----------
  function definirOperacao(op) {
    estado.operacao = op;
    const r = $(`input[name=operacao][value="${op}"]`);
    if (r) r.checked = true;
    $("#nota-operacao").textContent = NOTAS_OPERACAO[op];
    renderizar();
  }
  $$("input[name=operacao]").forEach((r) => r.addEventListener("change", () => definirOperacao(r.value)));
  $("#nota-operacao").textContent = NOTAS_OPERACAO[estado.operacao];

  $("#filtros").addEventListener("input", renderizar);

  // ---------- cartões ----------
  function lerFiltros() {
    return {
      faixa: $("#f-faixa").value,
      gbMin: Number($("#f-gb").value),
      perfil: $("#f-perfil").value,
    };
  }
  function linhas() {
    const n = parseInt($("#f-linhas").value, 10);
    return Number.isInteger(n) && n > 0 && n <= 500 ? n : 1;
  }

  function grande(p) {
    if (p.categoria === "movel") return [String(p.totalGB), "GB"];
    if (p.categoria === "fibra") return p.velocidadeMega >= 1000 ? ["1", " Giga"] : [String(p.velocidadeMega), " Mega"];
    if (p.categoria === "combo") return [`${p.velocidadeMega >= 1000 ? "1 Giga" : p.velocidadeMega + " Mega"} + ${p.franquiaGB + p.bonusGB}`, "GB"];
    return [p.nome, ""];
  }
  function detalhe(p) {
    if (p.categoria === "movel") return p.bonusGB ? `${p.franquiaGB}GB do plano + ${p.bonusGB}GB de bônus` : `${p.franquiaGB}GB do plano`;
    if (p.categoria === "fibra") return p.subtitulo;
    if (p.categoria === "combo") return `${p.subtitulo} · ${p.franquiaGB}GB + ${p.bonusGB}GB de bônus + ${p.megaBonusGB}GB de Mega Bônus`;
    return p.subtitulo;
  }
  function rotuloMensal(p) {
    return p.categoria === "movel" ? "/mês por linha" : "/mês";
  }
  function textoDepois(p) {
    const depois = p.promocao ? emCentavos(p.promocao.valorDepois) : null;
    if (p.promocao) {
      let t = `Por ${p.promocao.meses} meses. Depois, ${brl(depois)}/mês`;
      if (p.categoria === "fibra" && p.valorComMovel && emCentavos(p.valorComMovel) < depois) t += `, ou ${brl(emCentavos(p.valorComMovel))}/mês junto com Claro Pós`;
      return t + ".";
    }
    if (p.categoria === "fibra" && p.valorComMovel && p.valorComMovel < p.valorMensal) return `Ou ${brl(emCentavos(p.valorComMovel))}/mês junto com Claro Pós.`;
    return "";
  }

  function cartao(p) {
    const [g, un] = grande(p);
    const marcado = estado.comparados.some((c) => c.id === p.id);
    const v1 = precoNoMes(p, 1);
    const depois = textoDepois(p);
    const n = linhas();
    const chips = (p.beneficios || []).map(nomeBeneficio);
    const chipsMostrar = chips.slice(0, 4);

    const acoes = el("div", { classe: "cartao__acoes" });
    if (p.categoria !== "solucao") {
      const cb = el("input", { type: "checkbox", id: `cmp-${p.id}`, "data-id": p.id });
      cb.checked = marcado;
      cb.addEventListener("change", () => alternarComparacao(p, cb));
      acoes.append(el("label", { classe: "comparar", for: `cmp-${p.id}` }, [cb, `Comparar ${p.nome}`]));
    }
    acoes.append(el("a", {
      classe: "botao botao--whats", target: "_blank", rel: "noopener", "data-plano": p.id,
      href: linkWhats(consultor.whatsapp, msgPlano(consultor, p, estado.operacao)),
    }, [icone("i-whats"), p.categoria === "solucao" ? "Pedir informações" : "Quero este plano"]));

    return el("article", { classe: "cartao" + (marcado ? " cartao--marcado" : ""), "data-id": p.id, "aria-label": p.nome }, [
      el("div", { classe: "cartao__topo" }, [el("h3", { texto: p.categoria === "movel" ? "Claro Pós" : p.categoria === "fibra" ? "Claro fibra" : p.categoria === "combo" ? "Combo fibra + Claro Pós" : "Solução"}), p.selo ? el("span", { classe: "selo", texto: p.selo }) : null]),
      el("p", { classe: "cartao__gb" }, [g, el("small", { texto: un })]),
      el("p", { classe: "cartao__det", texto: detalhe(p) }),
      v1 == null
        ? el("p", { classe: "cartao__preco" }, [el("b", { texto: "Sob consulta" })])
        : el("p", { classe: "cartao__preco" }, [el("b", { texto: brl(v1) }), el("small", { texto: rotuloMensal(p) })]),
      depois ? el("p", { classe: "cartao__depois", texto: depois }) : null,
      p.categoria === "movel" && n > 1 ? el("p", { classe: "cartao__total", texto: `Para ${n} linhas: ${brl(v1 * n)}/mês` }) : null,
      chips.length ? el("ul", { classe: "cartao__chips", "aria-label": "Benefícios" }, [...chipsMostrar.map((c) => el("li", { texto: c })), chips.length > 4 ? el("li", { texto: `+${chips.length - 4}` }) : null]) : null,
      el("p", { classe: "cartao__cond", texto: `Fidelidade: ${p.fidelidade}` }),
      acoes,
    ]);
  }

  function renderizar() {
    const base = porCategoria(catalogo, estado.servico);
    let lista = base;
    if (estado.servico !== "solucao") {
      const f = lerFiltros();
      const ativos = FILTROS_POR_SERVICO[estado.servico];
      lista = filtrar(base, { faixa: ativos.includes("faixa") ? f.faixa : "todas", gbMin: ativos.includes("gb") ? f.gbMin : 0, perfil: ativos.includes("perfil") ? f.perfil : "" });
      lista = ordenar(lista, $("#f-ordem").value);
    }
    const alvo = $("#lista-planos");
    alvo.replaceChildren(...lista.map(cartao));
    $("#contagem").textContent = lista.length
      ? `${lista.length} ${lista.length === 1 ? "plano" : "planos"} em ${ROTULO_CATEGORIA[estado.servico].toLowerCase()}.`
      : "Nenhum plano com esses filtros. Tente ampliar a faixa de preço ou a internet mínima.";
    if (!lista.length) alvo.replaceChildren(el("p", { classe: "vazio", texto: "Nenhum plano encontrado com esses filtros." }));
  }

  // ---------- comparador ----------
  function alternarComparacao(plano, caixa) {
    if (!caixa.checked) {
      estado.comparados = estado.comparados.filter((p) => p.id !== plano.id);
    } else {
      const r = podeAdicionar(estado.comparados, plano);
      if (!r.ok) {
        caixa.checked = false;
        $("#aviso-comparar").textContent = r.motivo;
        $("#aviso-comparar").hidden = false;
        aviso(r.motivo);
        return;
      }
      estado.comparados.push(plano);
      $("#aviso-comparar").hidden = true;
    }
    $(`[data-id="${plano.id}"].cartao`)?.classList.toggle("cartao--marcado", caixa.checked);
    atualizarComparacao();
  }

  function atualizarComparacao() {
    const sel = estado.comparados;
    const bandeja = $("#bandeja");
    bandeja.hidden = sel.length === 0;
    $("#bandeja-n").textContent = String(sel.length);
    $("#bandeja-txt").textContent = sel.length === 1 ? "plano selecionado (escolha mais 1 ou 2)" : "planos selecionados";
    $("#bandeja-ver").hidden = sel.length < 2;

    const caixa = $("#comparacao");
    if (sel.length === 0) {
      caixa.replaceChildren(el("p", { classe: "vazio", texto: "Nenhum plano selecionado ainda. Marque “Comparar” em dois ou três planos da mesma categoria." }));
      return;
    }
    if (sel.length === 1) {
      caixa.replaceChildren(el("p", { classe: "vazio", texto: `Você escolheu ${sel[0].nome}. Marque mais um ou dois planos de ${ROTULO_CATEGORIA[sel[0].categoria].toLowerCase()} para comparar (até ${MAX_COMPARAR}).` }));
      return;
    }
    const linhasTab = linhasDaComparacao(sel, nomeBeneficio);
    const tabela = el("table", { classe: "tabela" }, [
      el("caption", { classe: "so-leitor", texto: `Comparação de ${sel.map((p) => p.nome).join(", ")}` }),
      el("thead", {}, [el("tr", {}, [el("th", { scope: "col", texto: "" }), ...sel.map((p) => el("th", { scope: "col" }, [p.nome, " ", el("button", { type: "button", classe: "botao botao--contorno botao--pequeno", "aria-label": `Remover ${p.nome} da comparação`, texto: "×", onclick: () => remover(p.id) })]))])]),
      el("tbody", {}, linhasTab.map((l) => el("tr", { classe: l.difere ? "difere" : "" }, [el("th", { scope: "row", texto: l.rotulo }), ...l.valores.map((v) => el("td", { texto: v }))]))),
      el("tfoot", {}, [el("tr", {}, [el("td"), ...sel.map((p) => el("td", {}, [el("a", { classe: "botao botao--whats botao--pequeno", target: "_blank", rel: "noopener", href: linkWhats(consultor.whatsapp, msgPlano(consultor, p, estado.operacao)) }, [icone("i-whats"), "Quero este"])]))])]),
    ]);
    const rec = recomendacoes(sel);
    caixa.replaceChildren(
      el("div", { classe: "rolagem", tabindex: "0", role: "region", "aria-label": "Tabela de comparação, role para os lados se necessário" }, [tabela]),
      el("ul", { classe: "recomendacoes", "aria-label": "Quem vence em cada critério" }, rec.map((r) => el("li", {}, [el("strong", { texto: r.criterio }), r.explicacao]))),
      el("p", { classe: "nota", texto: "As indicações acima seguem um critério único cada. Não existe plano “melhor” para todo mundo: depende do seu uso." }),
      el("a", { classe: "botao botao--whats", style: "margin-top:12px", target: "_blank", rel: "noopener", href: linkWhats(consultor.whatsapp, msgComparacao(consultor, sel)) }, [icone("i-whats"), "Pedir ajuda para escolher"])
    );
  }
  function remover(id) {
    estado.comparados = estado.comparados.filter((p) => p.id !== id);
    const cb = $(`#cmp-${CSS.escape(id)}`);
    if (cb) { cb.checked = false; cb.closest(".cartao")?.classList.remove("cartao--marcado"); }
    atualizarComparacao();
  }
  $("#bandeja-limpar").addEventListener("click", () => {
    estado.comparados = [];
    $$(".comparar input").forEach((c) => { c.checked = false; c.closest(".cartao")?.classList.remove("cartao--marcado"); });
    $("#aviso-comparar").hidden = true;
    atualizarComparacao();
  });

  abrirServico("movel");
  atualizarComparacao();
  return { abrirServico, definirOperacao };
}
