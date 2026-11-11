import { emCentavos } from "./formatar.js";
import { precoNoMes, porId } from "./catalogo.js";

export class ErroSimulacao extends Error {}

// Monta o que será cobrado: itens (plano, quantidade).
// Com fibra: usa o combo oficial (fibra + 1 linha) quando existe; as demais linhas ficam no plano móvel.
// Sem combo para a dupla escolhida: soma fibra avulsa + linhas.
export function montarItens(catalogo, { linhas, planoId, fibraId }) {
  const movel = porId(catalogo, planoId);
  if (!movel || movel.categoria !== "movel") throw new ErroSimulacao("Plano móvel inválido.");
  if (!fibraId) return { itens: [{ plano: movel, qtd: linhas }], combo: false };

  const fibra = porId(catalogo, fibraId);
  if (!fibra || fibra.categoria !== "fibra") throw new ErroSimulacao("Plano de fibra inválido.");
  const combo = catalogo.find(
    (p) => p.categoria === "combo" && p.componentes.fibra === fibraId && p.componentes.movel === planoId
  );
  if (combo) {
    const itens = [{ plano: combo, qtd: 1 }];
    if (linhas > 1) itens.push({ plano: movel, qtd: linhas - 1 });
    return { itens, combo: true };
  }
  return { itens: [{ plano: fibra, qtd: 1 }, { plano: movel, qtd: linhas }], combo: false };
}

export function custoDoMes(itens, mes) {
  return itens.reduce((soma, { plano, qtd }) => soma + precoNoMes(plano, mes) * qtd, 0);
}

export function custoClaroNoPeriodo(itens, meses) {
  let total = 0;
  for (let m = 1; m <= meses; m++) total += custoDoMes(itens, m);
  return total;
}

function validar({ linhas, valorAtualMensal }) {
  if (!Number.isInteger(linhas) || linhas < 1 || linhas > 500) throw new ErroSimulacao("Informe de 1 a 500 linhas.");
  if (!Number.isFinite(valorAtualMensal) || valorAtualMensal < 0) throw new ErroSimulacao("Informe o valor mensal atual.");
}

// Fórmulas:
//   custo atual no período = valor atual mensal × meses
//   custo Claro no período = soma do valor previsto de cada mês (promoções incluídas)
//   economia = custo atual − custo Claro   (negativo = custo adicional)
export function simular(catalogo, entrada) {
  validar(entrada);
  const { linhas, valorAtualMensal, planoId, fibraId = null } = entrada;
  const { itens, combo } = montarItens(catalogo, { linhas, planoId, fibraId });
  const atual = emCentavos(valorAtualMensal);

  const maiorPromo = Math.max(0, ...itens.map(({ plano }) => plano.promocao?.meses ?? 0));
  const mesFinal = maiorPromo + 1;
  const primeiroMes = custoDoMes(itens, 1);
  const depoisDaPromo = custoDoMes(itens, mesFinal);

  const periodo = (meses) => {
    const atualTotal = atual * meses;
    const claroTotal = custoClaroNoPeriodo(itens, meses);
    return { meses, custoAtual: atualTotal, custoClaro: claroTotal, economia: atualTotal - claroTotal };
  };

  return {
    combo,
    itens: itens.map(({ plano, qtd }) => ({ id: plano.id, nome: plano.nome, qtd })),
    valorAtualMensal: atual,
    novoValorPrimeiroMes: primeiroMes,
    novoValorDepoisDaPromocao: depoisDaPromo,
    temPromocao: primeiroMes !== depoisDaPromo,
    mesesDePromocao: maiorPromo,
    diferencaMensalPrimeiroMes: atual - primeiroMes,
    diferencaMensalDepois: atual - depoisDaPromo,
    p12: periodo(12),
    p24: periodo(24),
  };
}

// O prazo da promoção da internet (600 Mega) muda conforme a região: 0, 3 ou 6 meses.
// Por isso a simulação mostra o pior caso (sem promoção) e o melhor caso (6 meses).
function comMesesDePromocao(catalogo, meses) {
  return catalogo.map((p) => (p.promocao && p.promocaoVariavel ? { ...p, promocao: { ...p.promocao, meses } } : p));
}

export function simularFaixa(catalogo, entrada) {
  const base = simular(catalogo, entrada);
  const variavel = base.itens.some((i) => catalogo.find((p) => p.id === i.id)?.promocaoVariavel);
  if (!variavel) return { variavel: false, pior: base, melhor: base, base };
  const { minMeses, maxMeses } = { minMeses: 0, maxMeses: 6 };
  return {
    variavel: true,
    pior: simular(comMesesDePromocao(catalogo, minMeses), entrada),
    melhor: simular(comMesesDePromocao(catalogo, maxMeses), entrada),
    base,
  };
}
