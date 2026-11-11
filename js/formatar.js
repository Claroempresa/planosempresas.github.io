// Dinheiro sempre em centavos inteiros, para não acumular erro de arredondamento.
export function emCentavos(valor) {
  return Math.round(Number(valor) * 100);
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function brl(centavos) {
  // Intl usa espaço não separável entre "R$" e o número; trocamos por espaço comum
  return moeda.format(centavos / 100).replace(/ /g, " ");
}

export function lerValor(texto) {
  // aceita "1.250,50", "1250,5" e "1250.50"
  let t = String(texto ?? "").trim().replace(/[R$\s]/g, "");
  if (!t) return NaN;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export function mascaraCep(texto) {
  const d = String(texto ?? "").replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
}

export function cepValido(texto) {
  return /^\d{8}$/.test(String(texto ?? "").replace(/\D/g, ""));
}
