// Cria elementos com textContent (nunca innerHTML), para não abrir brecha de injeção de HTML.
export function el(tag, attrs = {}, filhos = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "texto") e.textContent = v;
    else if (k === "classe") e.className = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const f of [].concat(filhos)) if (f != null && f !== false) e.append(f.nodeType ? f : document.createTextNode(String(f)));
  return e;
}

export function icone(id, classe = "") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  if (classe) svg.setAttribute("class", classe);
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", "#" + id);
  svg.append(use);
  return svg;
}

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

let tempo;
export function aviso(texto) {
  let t = document.getElementById("toast");
  if (!t) {
    t = el("p", { id: "toast", role: "status", classe: "aviso aviso--atencao" });
    t.style.cssText = "position:fixed;left:12px;right:12px;bottom:calc(140px + env(safe-area-inset-bottom,0px));z-index:60;margin:0;box-shadow:0 8px 24px rgba(0,0,0,.25)";
    document.body.append(t);
  }
  t.textContent = texto;
  t.hidden = false;
  clearTimeout(tempo);
  tempo = setTimeout(() => (t.hidden = true), 6000);
}
