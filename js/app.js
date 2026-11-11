import { $, $$ } from "./dom.js";
import { iniciarContratar } from "./ui-contratar.js";
import { iniciarComparar } from "./ui-comparar.js";
import { iniciarEconomizar } from "./ui-economizar.js";
import { iniciarBeneficios, iniciarDepoimentos } from "./ui-beneficios.js";
import { iniciarMenu, iniciarWhatsApp, iniciarCobertura, iniciarInstalacao } from "./ui-extras.js";

const raiz = document.documentElement.dataset.raiz || "";
const consultor = JSON.parse($("#consultor-dados").textContent);

const VISTAS = ["inicio", "contratar", "economizar", "comparar", "beneficios", "cobertura", "instalar", "duvidas"];
// Links antigos usados nos disparos continuam funcionando.
const LINKS_ANTIGOS = {
  portabilidade: { vista: "contratar", servico: "movel", operacao: "portabilidade" },
  transferencia: { vista: "contratar", servico: "movel", operacao: "transferencia" },
  "linha-nova": { vista: "contratar", servico: "movel", operacao: "linha-nova" },
  internet: { vista: "contratar", servico: "fibra" },
  combo: { vista: "contratar", servico: "combo" },
  escolha: { vista: "contratar" },
  catalogo: { vista: "contratar" },
};

async function json(arquivo) {
  const r = await fetch(`${raiz}dados/${arquivo}`, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${arquivo}: ${r.status}`);
  return r.json();
}

iniciarMenu();
iniciarWhatsApp(consultor);
iniciarCobertura(consultor);
iniciarInstalacao(raiz);

const estado = { consultor, vistaAtual: "inicio", temDepoimentos: false };

function mostrarVista(nome, { foco }) {
  estado.vistaAtual = nome;
  for (const v of $$(".vista[data-vista]")) v.hidden = v.dataset.vista !== nome;
  $("#depoimentos").hidden = !(nome === "inicio" && estado.temDepoimentos);
  for (const a of $$("[data-vista-link]")) {
    if (a.dataset.vistaLink === nome) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
  estado.comparar?.atualizar();
  if (foco) {
    window.scrollTo(0, 0);
    const h1 = $(`#v-${nome} h1`);
    if (h1) { h1.setAttribute("tabindex", "-1"); h1.focus({ preventScroll: true }); }
  }
}

let primeira = true;
function rotear() {
  const hash = decodeURIComponent(location.hash.replace("#", ""));
  const antigo = LINKS_ANTIGOS[hash];
  const foco = !primeira;
  primeira = false;
  if (antigo) {
    mostrarVista(antigo.vista, { foco });
    if (antigo.servico) estado.contratar?.irPara(antigo.servico, antigo.operacao);
    else if (!estado.servico) estado.contratar?.reiniciar();
    return;
  }
  mostrarVista(VISTAS.includes(hash) ? hash : "inicio", { foco });
}

try {
  const [catalogo, beneficios, depoimentos] = await Promise.all([json("planos.json"), json("beneficios.json"), json("depoimentos.json")]);
  Object.assign(estado, { catalogo, beneficios, depoimentos });
  estado.comparar = iniciarComparar(estado);
  estado.contratar = iniciarContratar(estado);
  iniciarEconomizar(estado);
  iniciarBeneficios(estado);
  iniciarDepoimentos(estado);
  rotear();
  addEventListener("hashchange", rotear);
  document.documentElement.dataset.pronto = "1";
} catch (erro) {
  console.error(erro);
  $("#lista-planos").textContent = "Não foi possível carregar os planos agora. Fale comigo pelo WhatsApp.";
  rotear();
  document.documentElement.dataset.pronto = "1";
}
