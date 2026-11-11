import { brl } from "./formatar.js";
import { precoNoMes, ROTULO_CATEGORIA } from "./catalogo.js";

export const MAX_COMPARAR = 3;

// Só compara produtos da mesma categoria: celular não se compara com fibra.
export function podeAdicionar(selecionados, plano) {
  if (selecionados.some((p) => p.id === plano.id)) return { ok: false, motivo: "Esse plano já está na comparação." };
  if (selecionados.length >= MAX_COMPARAR) return { ok: false, motivo: `Compare até ${MAX_COMPARAR} planos por vez.` };
  if (selecionados.length && selecionados[0].categoria !== plano.categoria) {
    return {
      ok: false,
      motivo: `Compare produtos da mesma categoria. Você está comparando "${ROTULO_CATEGORIA[selecionados[0].categoria]}"; ` +
        `"${ROTULO_CATEGORIA[plano.categoria]}" tem regras e preços diferentes.`,
    };
  }
  if (plano.categoria === "solucao") return { ok: false, motivo: "Soluções complementares têm valor sob consulta e não entram na comparação." };
  return { ok: true };
}

function textoPreco(p) {
  const v1 = precoNoMes(p, 1);
  if (p.promocao) return `${brl(v1)} por ${p.promocaoVariavel ? `até ${p.promocaoVariavel.maxMeses}` : p.promocao.meses} meses, depois ${brl(precoNoMes(p, p.promocao.meses + 1))}`;
  return v1 == null ? "Sob consulta" : brl(v1);
}

// Retorna as linhas da tabela e marca as que diferem entre os planos.
export function linhasDaComparacao(planos, nomeBeneficio = (id) => id) {
  const linhas = [
    { rotulo: "Mensalidade", valores: planos.map(textoPreco) },
  ];
  if (planos[0].categoria === "movel" || planos[0].categoria === "combo") {
    linhas.push({ rotulo: "Internet do plano", valores: planos.map((p) => `${p.franquiaGB}GB`) });
    linhas.push({ rotulo: "Bônus de uso livre", valores: planos.map((p) => (p.bonusGB ? `${p.bonusGB}GB` : "Sem bônus")) });
    if (planos[0].categoria === "combo") linhas.push({ rotulo: "Mega Bônus compartilhável", valores: planos.map((p) => `${p.megaBonusGB}GB`) });
    linhas.push({ rotulo: "Internet total", valores: planos.map((p) => `${p.totalGB}GB`) });
  }
  if (planos[0].categoria === "fibra" || planos[0].categoria === "combo") {
    linhas.push({ rotulo: "Velocidade", valores: planos.map((p) => (p.velocidadeMega >= 1000 ? "1 Giga" : `${p.velocidadeMega} Mega`)) });
    linhas.push({ rotulo: "Wi-Fi", valores: planos.map((p) => p.subtitulo || "-") });
  }
  linhas.push({
    rotulo: "Aplicativos e benefícios",
    valores: planos.map((p) => (p.beneficios || []).map(nomeBeneficio).join(", ")),
    lista: true,
  });
  linhas.push({ rotulo: "Fidelidade", valores: planos.map((p) => p.fidelidade) });
  linhas.push({ rotulo: "Pagamento", valores: planos.map((p) => p.pagamento) });
  linhas.push({
    rotulo: "Custos adicionais",
    valores: planos.map((p) =>
      p.categoria === "movel"
        ? "Nenhum informado, além da mensalidade"
        : "Sem taxa de adesão na fidelidade de 24 meses"
    ),
  });
  linhas.push({ rotulo: "Condições", valores: planos.map((p) => p.restricoes) });
  return linhas.map((l) => ({ ...l, difere: new Set(l.valores).size > 1 }));
}

// Recomendações por critério explícito. Nunca diz "o melhor": diz qual vence em cada critério.
export function recomendacoes(planos) {
  if (planos.length < 2) return [];
  const comPreco = planos.filter((p) => precoNoMes(p, 1) != null);
  const out = [];
  const menor = [...comPreco].sort((a, b) => precoNoMes(a, 1) - precoNoMes(b, 1))[0];
  out.push({ criterio: "Menor mensalidade", plano: menor, explicacao: `${menor.nome}: ${textoPreco(menor)}.` });

  const comGB = planos.filter((p) => p.totalGB != null);
  if (comGB.length) {
    const maior = [...comGB].sort((a, b) => b.totalGB - a.totalGB)[0];
    out.push({ criterio: "Maior internet", plano: maior, explicacao: `${maior.nome}: ${maior.totalGB}GB no total.` });
    const porGB = [...comGB].sort((a, b) => precoNoMes(a, 1) / a.totalGB - precoNoMes(b, 1) / b.totalGB)[0];
    const reaisPorGB = brl(Math.round(precoNoMes(porGB, 1) / porGB.totalGB));
    out.push({ criterio: "Menor custo por GB", plano: porGB, explicacao: `${porGB.nome}: cerca de ${reaisPorGB} por GB (mensalidade do primeiro mês ÷ internet total).` });
  }
  return out;
}
