import { emCentavos } from "./formatar.js";

export const ROTULO_CATEGORIA = {
  movel: "Telefonia móvel",
  fibra: "Internet fibra",
  combo: "Combo fibra + móvel",
  solucao: "Solução complementar",
};

// Valor, em centavos, que o cliente paga no mês `mes` (1 = primeiro mês).
// Respeita promoção por tempo limitado: nunca trata o preço promocional como permanente.
export function precoNoMes(plano, mes) {
  if (plano.valorMensal == null) return null;
  const p = plano.promocao;
  if (p && mes > p.meses) return emCentavos(p.valorDepois);
  return emCentavos(plano.valorMensal);
}

export function porId(catalogo, id) {
  return catalogo.find((p) => p.id === id);
}

export function porCategoria(catalogo, categoria) {
  return catalogo.filter((p) => p.categoria === categoria);
}

export function totalInternetGB(plano) {
  return plano.totalGB ?? null;
}

// Regras transparentes dos perfis de uso (mostradas na tela).
export const PERFIS = {
  leve: { rotulo: "Uso leve (até 30GB)", regra: (p) => p.totalGB != null && p.totalGB <= 30 },
  medio: { rotulo: "Uso médio (de 31GB a 79GB)", regra: (p) => p.totalGB != null && p.totalGB > 30 && p.totalGB < 80 },
  intenso: { rotulo: "Uso intenso (80GB ou mais)", regra: (p) => p.totalGB != null && p.totalGB >= 80 },
  viagens: { rotulo: "Viaja a negócios (com Passaporte)", regra: (p) => (p.beneficios || []).includes("passaporte") },
};

export function filtrar(lista, { faixa = "todas", gbMin = 0, perfil = "" } = {}) {
  const faixas = { ate50: [0, 5000], de50a100: [5000, 10000], acima100: [10000, Infinity] };
  return lista.filter((p) => {
    const v = precoNoMes(p, 1);
    if (faixa !== "todas" && faixas[faixa]) {
      const [a, b] = faixas[faixa];
      if (v == null || v < a || v > b) return false;
    }
    if (gbMin && (p.totalGB ?? 0) < gbMin) return false;
    if (perfil && PERFIS[perfil] && !PERFIS[perfil].regra(p)) return false;
    return true;
  });
}

export function ordenar(lista, criterio) {
  const c = [...lista];
  if (criterio === "preco") c.sort((a, b) => (precoNoMes(a, 1) ?? Infinity) - (precoNoMes(b, 1) ?? Infinity));
  if (criterio === "internet") c.sort((a, b) => (b.totalGB ?? 0) - (a.totalGB ?? 0));
  return c;
}
