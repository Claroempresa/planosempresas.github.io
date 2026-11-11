import { el, icone, $, $$ } from "./dom.js";

const ETIQUETA = {
  incluso: ["Incluso no plano", "etiqueta--incluso"],
  desconto: ["Desconto de parceiro", "etiqueta--desconto"],
  contratacao: ["Contratação adicional", "etiqueta--pago"],
};

// Logo do benefício; sem logo, usa o ícone. Os logos brancos ficam sobre fundo escuro.
function marca(b, raiz) {
  const dentro = b.logos?.length
    ? b.logos.map((arq) => el("img", { src: `${raiz}logos/${arq}`, alt: "", loading: "lazy", decoding: "async" }))
    : [icone(b.icone || "i-check")];
  return el("div", { classe: "beneficio__logo" + (b.logoEscuro ? " beneficio__logo--escuro" : "") + (b.logos?.length ? "" : " beneficio__logo--icone"), "aria-hidden": "true" }, dentro);
}

export function iniciarBeneficios(estado) {
  const { beneficios } = estado;
  const raiz = document.documentElement.dataset.raiz || "";
  const alvo = $("#lista-beneficios");
  function render(cat) {
    const lista = cat === "todos" ? beneficios : beneficios.filter((b) => b.categoria === cat);
    alvo.replaceChildren(...lista.map((b) => {
      const [txt, cls] = ETIQUETA[b.tipo] ?? ETIQUETA.incluso;
      return el("article", { classe: "beneficio" }, [
        marca(b, raiz),
        el("div", { classe: "beneficio__corpo" }, [
          el("h3", { texto: b.nome }),
          el("span", { classe: `etiqueta ${cls}`, texto: txt }),
          el("p", { texto: b.explicacao }),
          el("details", {}, [el("summary", { texto: "Para quem e condições" }), el("div", { classe: "detalhes" }, [
            el("p", {}, [el("strong", { texto: "Vale para: " }), b.aplicabilidade]),
            el("p", {}, [el("strong", { texto: "Condições: " }), b.condicoes]),
          ])]),
        ]),
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
  $("#lista-depoimentos").replaceChildren(...lista.map((d) => el("figure", { classe: "cartao", style: "margin:0" }, [
    el("blockquote", { style: "margin:0", texto: `“${d.texto}”` }),
    el("figcaption", { classe: "cartao__det", texto: [d.nome, d.empresa].filter(Boolean).join(" · ") }),
  ])));
  estado.temDepoimentos = true;
}
