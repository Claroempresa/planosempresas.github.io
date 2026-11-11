import { el, icone, $, $$ } from "./dom.js";
import { brl, emCentavos } from "./formatar.js";
import { precoNoMes, porCategoria, filtrar, ordenar, PERFIS, ROTULO_CATEGORIA } from "./catalogo.js";
import { linkWhats, msgPlano } from "./whatsapp.js";

const NOTAS_OPERACAO = {
  portabilidade: "Você traz o número de outra operadora para a Claro e continua com ele. Sujeito à análise de elegibilidade e de crédito.",
  transferencia: "A linha já é Claro e passa do seu CPF para o CNPJ da empresa, mantendo o número. Sujeito à análise de elegibilidade.",
  "linha-nova": "Linha nova no CNPJ da empresa. Sujeito à análise de crédito.",
};
// Quais filtros fazem sentido para cada serviço.
const FILTROS = { movel: ["ordem", "faixa", "gb", "linhas"], fibra: ["ordem", "faixa"], combo: ["ordem", "faixa", "gb"], solucao: [] };
const COM_PERFIL = ["movel", "combo"];

export function iniciarContratar(estado) {
  const { catalogo, beneficios, consultor } = estado;
  const nomeBeneficio = (id) => beneficios.find((b) => b.id === id)?.nome ?? id;
  estado.servico = "movel";
  estado.operacao = "portabilidade";
  let perfil = "";

  // ---------- abas de serviço ----------
  const abas = $$("#servicos [role=tab]");
  abas.forEach((aba, i) => {
    aba.addEventListener("click", () => abrirServico(aba.dataset.servico));
    aba.addEventListener("keydown", (e) => {
      const passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!passo) return;
      e.preventDefault();
      abrirServico(abas[(i + passo + abas.length) % abas.length].dataset.servico, { foco: true });
    });
  });
  function abrirServico(servico, { foco = false } = {}) {
    estado.servico = servico;
    perfil = "";
    abas.forEach((a) => {
      const sel = a.dataset.servico === servico;
      a.setAttribute("aria-selected", String(sel));
      a.tabIndex = sel ? 0 : -1;
      if (sel) { $("#painel-servico").setAttribute("aria-labelledby", a.id); if (foco) a.focus(); }
    });
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

  // ---------- filtros ----------
  function atualizarFiltros() {
    const ativos = FILTROS[estado.servico] || [];
    const mapa = { ordem: "#f-ordem", faixa: "#f-faixa", gb: "#f-gb", linhas: "#f-linhas" };
    for (const [k, sel] of Object.entries(mapa)) $(sel).closest("label").hidden = !ativos.includes(k);
    $("#mais-filtros").hidden = ativos.length === 0;
    $("#operacoes").hidden = estado.servico !== "movel";
    $("#nota-operacao").hidden = estado.servico !== "movel";
    const perfis = $("#perfis");
    perfis.hidden = !COM_PERFIL.includes(estado.servico);
    if (!perfis.hidden) {
      perfis.replaceChildren(
        el("button", { type: "button", "aria-pressed": String(perfil === ""), texto: "Todos", onclick: () => { perfil = ""; renderizar(); } }),
        ...Object.entries(PERFIS).map(([id, p]) => el("button", { type: "button", "aria-pressed": String(perfil === id), texto: p.rotulo, onclick: () => { perfil = perfil === id ? "" : id; renderizar(); } }))
      );
    }
  }
  $("#filtros").addEventListener("input", renderizar);

  // ---------- cartões ----------
  const linhas = () => { const n = parseInt($("#f-linhas").value, 10); return Number.isInteger(n) && n > 0 && n <= 500 ? n : 1; };
  function grande(p) {
    if (p.categoria === "movel") return [String(p.totalGB), "GB"];
    if (p.categoria === "fibra") return p.velocidadeMega >= 1000 ? ["1", " Giga"] : [String(p.velocidadeMega), " Mega"];
    if (p.categoria === "combo") return [`${p.velocidadeMega >= 1000 ? "1 Giga" : p.velocidadeMega + " Mega"} + ${p.franquiaGB + p.bonusGB}`, "GB"];
    return [p.nome, ""];
  }
  function detalheCurto(p) {
    if (p.categoria === "movel") return p.bonusGB ? `${p.franquiaGB}GB do plano + ${p.bonusGB}GB de bônus` : `${p.franquiaGB}GB do plano`;
    if (p.categoria === "fibra") return p.subtitulo;
    if (p.categoria === "combo") return `${p.subtitulo} · inclui +${p.megaBonusGB}GB de Mega Bônus`;
    return p.subtitulo;
  }
  function textoDepois(p) {
    if (!p.promocao) return "";
    const depois = brl(emCentavos(p.promocao.valorDepois));
    if (p.promocaoVariavel) return `Por até ${p.promocaoVariavel.maxMeses} meses, conforme a região. Depois, ${depois}/mês.`;
    return `Por ${p.promocao.meses} meses. Depois, ${depois}/mês.`;
  }
  function detalhes(p) {
    const itens = [];
    if (p.categoria === "movel" || p.categoria === "combo") itens.push(el("p", {}, [el("strong", { texto: "Internet: " }), `${p.franquiaGB}GB do plano${p.bonusGB ? ` + ${p.bonusGB}GB de bônus` : ""}${p.megaBonusGB ? ` + ${p.megaBonusGB}GB de Mega Bônus` : ""} = ${p.totalGB}GB`]));
    if (p.categoria === "fibra" && p.valorComMovel != null && p.valorComMovel < (p.promocao?.valorDepois ?? p.valorMensal)) {
      itens.push(el("p", {}, [el("strong", { texto: "Junto com Claro Pós: " }), `${brl(emCentavos(p.valorComMovel))}/mês${p.promocao ? " depois da promoção" : ""}`]));
    }
    if (p.beneficios?.length) itens.push(el("div", {}, [el("strong", { texto: "Inclui" }), el("ul", {}, p.beneficios.map((b) => el("li", { texto: nomeBeneficio(b) })))]));
    itens.push(el("p", {}, [el("strong", { texto: "Fidelidade: " }), p.fidelidade]));
    itens.push(el("p", {}, [el("strong", { texto: "Pagamento: " }), p.pagamento]));
    itens.push(el("p", { texto: p.restricoes }));
    return el("div", { classe: "detalhes" }, itens);
  }
  function cartao(p) {
    const [g, un] = grande(p);
    const v1 = precoNoMes(p, 1);
    const n = linhas();
    const depois = textoDepois(p);
    const cb = el("input", { type: "checkbox", id: `cmp-${p.id}` });
    cb.checked = estado.comparados.some((c) => c.id === p.id);
    cb.addEventListener("change", () => estado.comparar.alternar(p, cb));
    const titulo = p.categoria === "movel" ? "Claro Pós" : p.categoria === "fibra" ? "Claro fibra" : p.categoria === "combo" ? "Combo fibra + Claro Pós" : "Solução";
    return el("article", { classe: "cartao" + (cb.checked ? " cartao--marcado" : ""), "data-id": p.id, "aria-label": p.nome }, [
      el("div", { classe: "cartao__topo" }, [el("h3", { texto: titulo }), p.selo ? el("span", { classe: "selo", texto: p.selo }) : null]),
      el("p", { classe: "cartao__gb" }, [g, el("small", { texto: un })]),
      el("p", { classe: "cartao__det", texto: detalheCurto(p) }),
      v1 == null
        ? el("p", { classe: "cartao__preco" }, [el("b", { texto: "Sob consulta" })])
        : el("p", { classe: "cartao__preco" }, [el("b", { texto: brl(v1) }), el("small", { texto: p.categoria === "movel" ? "por mês, por linha" : "por mês" })]),
      depois ? el("p", { classe: "cartao__depois", texto: depois }) : null,
      p.categoria === "movel" && n > 1 ? el("p", { classe: "cartao__total", texto: `Para ${n} linhas: ${brl(v1 * n)}/mês` }) : null,
      el("div", { classe: "cartao__acoes" }, [
        el("a", { classe: "botao botao--whats", target: "_blank", rel: "noopener", "data-plano": p.id, href: linkWhats(consultor.whatsapp, msgPlano(consultor, p, estado.operacao)) }, [icone("i-whats"), p.categoria === "solucao" ? "Pedir informações" : "Quero este plano"]),
      ]),
      el("div", { classe: "cartao__mais" }, [
        el("details", {}, [el("summary", { texto: "Ver detalhes" }), detalhes(p)]),
        p.categoria !== "solucao" ? el("label", { classe: "comparar", for: `cmp-${p.id}` }, [cb, "Comparar"]) : null,
      ]),
    ]);
  }

  function renderizar() {
    atualizarFiltros();
    const base = porCategoria(catalogo, estado.servico);
    let lista = base;
    if (estado.servico !== "solucao") {
      const ativos = FILTROS[estado.servico];
      lista = filtrar(base, {
        faixa: ativos.includes("faixa") ? $("#f-faixa").value : "todas",
        gbMin: ativos.includes("gb") ? Number($("#f-gb").value) : 0,
        perfil: COM_PERFIL.includes(estado.servico) ? perfil : "",
      });
      lista = ordenar(lista, $("#f-ordem").value);
    }
    $("#lista-planos").replaceChildren(...(lista.length ? lista.map(cartao) : [el("p", { classe: "vazio", texto: "Nenhum plano com esses filtros. Tente ampliar a faixa de preço ou a internet mínima." })]));
    $("#contagem").textContent = lista.length ? `${lista.length} ${lista.length === 1 ? "plano" : "planos"} em ${ROTULO_CATEGORIA[estado.servico].toLowerCase()}.` : "";
  }

  // Atalhos vindos de links antigos (#portabilidade, #internet...).
  function irPara(servico, operacao) {
    if (operacao) { estado.operacao = operacao; const r = $(`input[name=operacao][value="${operacao}"]`); if (r) r.checked = true; $("#nota-operacao").textContent = NOTAS_OPERACAO[operacao]; }
    abrirServico(servico);
  }

  $("#nota-operacao").textContent = NOTAS_OPERACAO[estado.operacao];
  renderizar();
  return { irPara, renderizar };
}
