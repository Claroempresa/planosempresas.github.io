import { el, $, $$ } from "./dom.js";
import { cepValido, mascaraCep } from "./formatar.js";
import { linkWhats, msgCobertura, msgGeral, msgAnalise } from "./whatsapp.js";

export function iniciarMenu() {
  const botao = $(".topo__menu");
  const menu = $("#menu");
  const fechar = () => { menu.classList.remove("aberto"); botao.setAttribute("aria-expanded", "false"); botao.setAttribute("aria-label", "Abrir menu"); };
  botao.addEventListener("click", () => {
    const abrir = !menu.classList.contains("aberto");
    menu.classList.toggle("aberto", abrir);
    botao.setAttribute("aria-expanded", String(abrir));
    botao.setAttribute("aria-label", abrir ? "Fechar menu" : "Abrir menu");
  });
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) fechar(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menu.classList.contains("aberto")) { fechar(); botao.focus(); } });
}

export function iniciarWhatsApp(consultor) {
  $$("[data-whats]").forEach((a) => {
    const msg = a.dataset.whats === "analise" ? msgAnalise(consultor) : msgGeral(consultor);
    a.href = linkWhats(consultor.whatsapp, msg);
  });
}

export function iniciarCobertura(consultor) {
  const cep = $("#c-cep");
  cep.addEventListener("input", () => { cep.value = mascaraCep(cep.value); });
  $("#cobertura-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const erro = $("#erro-cobertura");
    if (!cepValido(cep.value)) {
      erro.textContent = "Informe um CEP com 8 números, por exemplo 84010-000.";
      erro.hidden = false;
      cep.focus();
      return;
    }
    erro.hidden = true;
    // O site NÃO consulta nem inventa cobertura: só encaminha o pedido ao consultor.
    const url = linkWhats(consultor.whatsapp, msgCobertura(consultor, { cep: cep.value, numero: $("#c-numero").value.trim(), complemento: $("#c-compl").value.trim() }));
    const a = el("a", { href: url, target: "_blank", rel: "noopener" });
    document.body.append(a);
    a.click();
    a.remove();
  });
}

export function iniciarInstalacao(raiz) {
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (standalone) {
    $("#instalar").remove();
    $$('a[href="#instalar"]').forEach((a) => (a.hidden = true));
    return;
  }
  const ua = navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const noutro = /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(ua);
  $("#aviso-navegador").hidden = !noutro;

  const abas = $$("#instalar [role=tab]");
  function mostrar(so) {
    abas.forEach((a) => { const s = a.dataset.so === so; a.setAttribute("aria-selected", String(s)); a.tabIndex = s ? 0 : -1; });
    $("#passos-android").hidden = so !== "android";
    $("#passos-iphone").hidden = so !== "iphone";
  }
  abas.forEach((a, i) => {
    a.addEventListener("click", () => mostrar(a.dataset.so));
    a.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const prox = abas[(i + 1) % abas.length];
      mostrar(prox.dataset.so);
      prox.focus();
    });
  });
  mostrar(ios ? "iphone" : "android");

  // Android/Chrome: aparece um botão de instalar quando o navegador permite.
  let evento = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    evento = e;
    $("#btn-instalar").hidden = false;
  });
  $("#btn-instalar").addEventListener("click", async () => {
    if (!evento) return;
    evento.prompt();
    await evento.userChoice.catch(() => {});
    evento = null;
    $("#btn-instalar").hidden = true;
  });
  window.addEventListener("appinstalled", () => { $("#btn-instalar").hidden = true; });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register(`${raiz}sw.js`, { scope: raiz || "./" }).catch(() => {});
  }
}
