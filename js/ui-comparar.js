import { el, icone, $, $$, aviso } from "./dom.js";
import { ROTULO_CATEGORIA } from "./catalogo.js";
import { MAX_COMPARAR, podeAdicionar, linhasDaComparacao, recomendacoes } from "./comparador.js";
import { linkWhats, msgPlano, msgComparacao } from "./whatsapp.js";

export function iniciarComparar(estado) {
  const { beneficios, consultor } = estado;
  const nomeBeneficio = (id) => beneficios.find((b) => b.id === id)?.nome ?? id;
  estado.comparados = [];

  function marcarCartoes() {
    $$(".cartao[data-id]").forEach((c) => {
      const marcado = estado.comparados.some((p) => p.id === c.dataset.id);
      c.classList.toggle("cartao--marcado", marcado);
      const cb = c.querySelector(".comparar input");
      if (cb) cb.checked = marcado;
    });
  }

  function alternar(plano, caixa) {
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
    marcarCartoes();
    atualizar();
  }

  function remover(id) {
    estado.comparados = estado.comparados.filter((p) => p.id !== id);
    marcarCartoes();
    atualizar();
  }

  function limpar() {
    estado.comparados = [];
    $("#aviso-comparar").hidden = true;
    marcarCartoes();
    atualizar();
  }

  function atualizar() {
    const sel = estado.comparados;
    $("#bandeja").hidden = sel.length === 0 || estado.comparacaoVisivel === true || estado.contratarVisivel === false;
    $("#bandeja-n").textContent = String(sel.length);
    $("#bandeja-txt").textContent = sel.length === 1 ? "plano selecionado (escolha mais 1 ou 2)" : "planos selecionados";
    $("#bandeja-ver").hidden = sel.length < 2;

    const caixa = $("#comparacao");
    if (sel.length === 0) {
      caixa.replaceChildren(el("p", { classe: "vazio", texto: "Nenhum plano selecionado ainda. Marque “Comparar” em dois ou três planos da mesma categoria, na seção Contratar." }));
      return;
    }
    const botaoLimpar = () => el("button", { type: "button", id: "comparar-limpar", classe: "botao botao--contorno botao--pequeno", texto: "Limpar comparação", onclick: limpar });
    if (sel.length === 1) {
      caixa.replaceChildren(
        el("p", { classe: "vazio", texto: `Você escolheu ${sel[0].nome}. Marque mais um ou dois planos de ${ROTULO_CATEGORIA[sel[0].categoria].toLowerCase()} para comparar (até ${MAX_COMPARAR}).` }),
        el("div", { classe: "acoes" }, [botaoLimpar()])
      );
      return;
    }
    const linhasTab = linhasDaComparacao(sel, nomeBeneficio);
    const tabela = el("table", { classe: "tabela" }, [
      el("caption", { classe: "so-leitor", texto: `Comparação de ${sel.map((p) => p.nome).join(", ")}` }),
      el("thead", {}, [el("tr", {}, [el("th", { scope: "col", texto: "" }), ...sel.map((p) => el("th", { scope: "col" }, [p.nome, " ", el("button", { type: "button", classe: "botao botao--contorno botao--pequeno", style: "color:#fff;border-color:rgba(255,255,255,.5);min-height:32px;padding:2px 10px", "aria-label": `Remover ${p.nome} da comparação`, texto: "×", onclick: () => remover(p.id) })]))])]),
      el("tbody", {}, linhasTab.map((l) => el("tr", { classe: l.difere ? "difere" : "" }, [el("th", { scope: "row", texto: l.rotulo }), ...l.valores.map((v) => el("td", { texto: v }))]))),
      el("tfoot", {}, [el("tr", {}, [el("td"), ...sel.map((p) => el("td", {}, [el("a", { classe: "botao botao--whats botao--pequeno", target: "_blank", rel: "noopener", href: linkWhats(consultor.whatsapp, msgPlano(consultor, p, estado.operacao)) }, [icone("i-whats"), "Quero este"])]))])]),
    ]);
    const rec = recomendacoes(sel);
    caixa.replaceChildren(
      el("div", { classe: "rolagem", tabindex: "0", role: "region", "aria-label": "Tabela de comparação, role para os lados se necessário" }, [tabela]),
      el("ul", { classe: "recomendacoes", "aria-label": "Quem vence em cada critério" }, rec.map((r) => el("li", {}, [el("strong", { texto: r.criterio }), r.explicacao]))),
      el("p", { classe: "nota", texto: "Cada indicação segue um critério só. Não existe plano “melhor” para todo mundo: depende do seu uso." }),
      el("div", { classe: "acoes" }, [
        el("a", { classe: "botao botao--whats", target: "_blank", rel: "noopener", href: linkWhats(consultor.whatsapp, msgComparacao(consultor, sel)) }, [icone("i-whats"), "Pedir ajuda para escolher"]),
        botaoLimpar(),
      ])
    );
  }

  $("#bandeja-limpar").addEventListener("click", limpar);
  if ("IntersectionObserver" in window) {
    // a bandeja só aparece enquanto você escolhe planos (seção Contratar) e some quando a comparação já está na tela
    new IntersectionObserver(([e]) => { estado.comparacaoVisivel = e.isIntersecting; atualizar(); }, { threshold: 0.25 }).observe($("#comparar"));
    new IntersectionObserver(([e]) => { estado.contratarVisivel = e.isIntersecting; atualizar(); }, { threshold: 0.05 }).observe($("#contratar"));
  }
  atualizar();
  return { alternar, atualizar, marcarCartoes };
}
