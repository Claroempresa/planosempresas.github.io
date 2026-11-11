import { $ } from "./dom.js";
import { iniciarContratar } from "./ui-contratar.js";
import { iniciarEconomizar } from "./ui-economizar.js";
import { iniciarBeneficios, iniciarDepoimentos } from "./ui-beneficios.js";
import { iniciarMenu, iniciarWhatsApp, iniciarCobertura, iniciarInstalacao } from "./ui-extras.js";

const raiz = document.documentElement.dataset.raiz || "";
const consultor = JSON.parse($("#consultor-dados").textContent);

async function json(arquivo) {
  const r = await fetch(`${raiz}dados/${arquivo}`, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${arquivo}: ${r.status}`);
  return r.json();
}

// Links antigos usados nos disparos continuam funcionando.
const LINKS_ANTIGOS = {
  portabilidade: { servico: "movel", operacao: "portabilidade", destino: "contratar" },
  transferencia: { servico: "movel", operacao: "transferencia", destino: "contratar" },
  "linha-nova": { servico: "movel", operacao: "linha-nova", destino: "contratar" },
  internet: { servico: "fibra", destino: "contratar" },
  combo: { servico: "combo", destino: "contratar" },
  escolha: { destino: "contratar" },
};

iniciarMenu();
iniciarWhatsApp(consultor);
iniciarCobertura(consultor);
iniciarInstalacao(raiz);

try {
  const [catalogo, beneficios, depoimentos] = await Promise.all([json("planos.json"), json("beneficios.json"), json("depoimentos.json")]);
  const estado = { catalogo, beneficios, depoimentos, consultor };
  const contratar = iniciarContratar(estado);
  iniciarEconomizar(estado);
  iniciarBeneficios(estado);
  iniciarDepoimentos(estado);

  const aplicarHash = (rolar) => {
    const h = decodeURIComponent(location.hash.replace("#", ""));
    const a = LINKS_ANTIGOS[h];
    if (!a) return;
    if (a.servico) contratar.abrirServico(a.servico);
    if (a.operacao) contratar.definirOperacao(a.operacao);
    if (rolar) document.getElementById(a.destino)?.scrollIntoView();
  };
  aplicarHash(true);
  addEventListener("hashchange", () => aplicarHash(true));
  document.documentElement.dataset.pronto = "1";
} catch (erro) {
  console.error(erro);
  $("#lista-planos").textContent = "Não foi possível carregar os planos agora. Fale comigo pelo WhatsApp.";
}
