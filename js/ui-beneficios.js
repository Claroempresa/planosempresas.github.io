import { el, icone, $, $$ } from "./dom.js";

const ETIQUETA = {
  incluso: ["Incluso no plano", "etiqueta--incluso"],
  desconto: ["Desconto de parceiro", "etiqueta--desconto"],
  contratacao: ["Contratação adicional", "etiqueta--pago"],
};

export function iniciarBeneficios(estado) {
  const { beneficios } = estado;
  const alvo = $("#lista-beneficios");
  function render(cat) {
    const lista = cat === "todos" ? beneficios : beneficios.filter((b) => b.categoria === cat);
    alvo.replaceChildren(...lista.map((b) => {
      const [txt, cls] = ETIQUETA[b.tipo] ?? ETIQUETA.incluso;
      return el("article", { classe: "beneficio" }, [
        el("div", { classe: "beneficio__topo" }, [
          el("span", { classe: "beneficio__icone" }, [icone(b.icone || "i-check")]),
          el("div", {}, [el("h3", { texto: b.nome }), el("span", { classe: `etiqueta ${cls}`, texto: txt })]),
        ]),
        el("p", { texto: b.explicacao }),
        el("p", { classe: "aplica" }, [el("strong", { texto: "Vale para: " }), b.aplicabilidade]),
        el("p", { classe: "cond" }, [el("strong", { texto: "Condições: " }), b.condicoes]),
      ]);
    }));
  }
  $$("#abas-beneficios button").forEach((b) => b.addEventListener("click", () => {
    $$("#abas-beneficios button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    render(b.dataset.cat);
  }));
  render("todos");
}

export function iniciarDepoimentos(estado) {
  // Só aparecem depoimentos reais e autorizados. Sem nenhum, a seção continua oculta.
  const lista = (estado.depoimentos || []).filter((d) => d.autorizado === true && d.texto && d.nome);
  if (!lista.length) return;
  $("#lista-depoimentos").replaceChildren(...lista.map((d) => el("figure", { classe: "beneficio", style: "margin:0" }, [
    el("blockquote", { style: "margin:0", texto: `“${d.texto}”` }),
    el("figcaption", { classe: "cond", texto: [d.nome, d.empresa].filter(Boolean).join(" · ") }),
  ])));
  $("#depoimentos").hidden = false;
}
