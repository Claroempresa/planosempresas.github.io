import { $, $$ } from "./dom.js";
import { iniciarContratar } from "./ui-contratar.js";
import { iniciarComparar } from "./ui-comparar.js";
import { iniciarEconomizar } from "./ui-economizar.js";
import { iniciarBeneficios, iniciarDepoimentos } from "./ui-beneficios.js";
import { iniciarMenu, iniciarWhatsApp, iniciarCobertura, iniciarInstalacao } from "./ui-extras.js";

const raiz = document.documentElement.dataset.raiz || "";
const consultor = JSON.parse($("#consultor-dados").textContent);

// Links antigos usados nos disparos continuam funcionando: escolhem o serviço e rolam até os planos.
const LINKS_ANTIGOS = {
  portabilidade: { servico: "movel", operacao: "portabilidade" },
  transferencia: { servico: "movel", operacao: "transferencia" },
  "linha-nova": { servico: "movel", operacao: "linha-nova" },
  internet: { servico: "fibra" },
  combo: { servico: "combo" },
  escolha: {},
  catalogo: {},
};

async function json(arquivo) {
  const r = await fetch(`${raiz}dados/${arquivo}`, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${arquivo}: ${r.status}`);
  return r.json();
}

// Cada seção aparece suavemente quando você chega nela. Sem JS, sem IntersectionObserver
// ou com "reduzir movimento" ligado, tudo já fica visível desde o começo (a classe js-revela é ligada no <head>).
function iniciarAparecer() {
  if (!document.documentElement.classList.contains("js-revela")) return;   // ligado no <head>, antes do primeiro desenho
  const alvos = $$(".secao .conteudo > *, .chamada .conteudo > *");
  const obs = new IntersectionObserver((entradas) => {
    for (const e of entradas) if (e.isIntersecting) { e.target.classList.add("visivel"); obs.unobserve(e.target); }
  }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });
  alvos.forEach((x) => obs.observe(x));
  // rede de segurança: se algo ficou escondido por qualquer motivo, mostra depois de alguns segundos
  setTimeout(() => alvos.forEach((x) => x.classList.add("visivel")), 8000);
}

// Destaca no menu a seção que está na tela.
function iniciarSecaoAtual() {
  if (!("IntersectionObserver" in window)) return;
  const links = new Map($$("#menu a[href^='#']").map((a) => [a.getAttribute("href").slice(1), a]));
  const obs = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      const a = links.get(e.target.id);
      if (!a) continue;
      if (e.isIntersecting) { links.forEach((x) => x.removeAttribute("aria-current")); a.setAttribute("aria-current", "true"); }
    }
  }, { rootMargin: "-35% 0px -60% 0px" });
  for (const id of links.keys()) { const s = document.getElementById(id); if (s) obs.observe(s); }
}

iniciarMenu();
iniciarWhatsApp(consultor);
iniciarCobertura(consultor);
iniciarInstalacao(raiz);

const estado = { consultor, comparacaoVisivel: false, temDepoimentos: false };
try {
  const [catalogo, beneficios, depoimentos] = await Promise.all([json("planos.json"), json("beneficios.json"), json("depoimentos.json")]);
  Object.assign(estado, { catalogo, beneficios, depoimentos });
  estado.comparar = iniciarComparar(estado);
  estado.contratar = iniciarContratar(estado);
  iniciarEconomizar(estado);
  iniciarBeneficios(estado);
  iniciarDepoimentos(estado);
  if (estado.temDepoimentos) $("#depoimentos").hidden = false;

  const aplicarHashAntigo = () => {
    const a = LINKS_ANTIGOS[decodeURIComponent(location.hash.replace("#", ""))];
    if (!a) return;
    if (a.servico) estado.contratar.irPara(a.servico, a.operacao);
    $("#contratar").scrollIntoView();
  };
  aplicarHashAntigo();
  addEventListener("hashchange", aplicarHashAntigo);
} catch (erro) {
  console.error(erro);
  $("#lista-planos").textContent = "Não foi possível carregar os planos agora. Fale comigo pelo WhatsApp.";
}
iniciarAparecer();
iniciarSecaoAtual();
document.documentElement.dataset.pronto = "1";
