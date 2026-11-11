import { brl, emCentavos } from "./formatar.js";

export function linkWhats(numero, texto) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

const OPERACOES = {
  portabilidade: (nome) => `Quero fazer portabilidade para o plano ${nome}.`,
  "linha-nova": (nome) => `Quero contratar uma linha nova no plano ${nome}.`,
  transferencia: (nome) => `Quero transferir minha linha do CPF para o CNPJ no plano ${nome}.`,
};

export function msgGeral(c) {
  return `Olá, ${c.primeiroNome}! Vim pelo site e quero falar sobre os planos Claro.`;
}

export function msgAnalise(c) {
  return `Olá, ${c.primeiroNome}! Quero a análise gratuita da minha conta. Vou te mandar a foto da minha fatura.`;
}

export function msgPlano(c, plano, operacao = "portabilidade") {
  const valor = plano.valorMensal != null ? brl(emCentavos(plano.valorMensal)) : "valor sob consulta";
  const rotuloPreco = plano.promocao ? `${valor} por ${plano.promocaoVariavel ? `até ${plano.promocaoVariavel.maxMeses}` : plano.promocao.meses} meses` : valor;
  const nome = `${plano.nome} – ${rotuloPreco}`;
  if (plano.categoria === "movel") return `Olá, ${c.primeiroNome}! ${OPERACOES[operacao](nome)}`;
  if (plano.categoria === "fibra") return `Olá, ${c.primeiroNome}! Quero a internet Wi-Fi Claro fibra, plano ${nome}. O CEP da empresa é: `;
  if (plano.categoria === "combo") return `Olá, ${c.primeiroNome}! Quero o combo internet ${nome}. O CEP da empresa é: `;
  return `Olá, ${c.primeiroNome}! Quero saber mais sobre ${plano.nome}.`;
}

export function msgComparacao(c, planos) {
  return `Olá, ${c.primeiroNome}! Comparei estes planos no site: ${planos.map((p) => p.nome).join(" | ")}. Pode me ajudar a escolher?`;
}

export function msgSimulacao(c, d) {
  const f = d.faixa;
  const meses = d.meses;
  const eco = (sim) => (meses === 12 ? sim.p12 : sim.p24).economia;
  const dizer = (v) => (v >= 0 ? `economia de ${brl(v)}` : `custo adicional de ${brl(-v)}`);
  let linhaEco;
  if (f.variavel) {
    const a = eco(f.pior), b = eco(f.melhor);
    linhaEco = `Estimativa em ${meses} meses: ${dizer(a)} (sem promoção da internet) a ${dizer(b)} (promoção de 6 meses). O prazo da promoção depende da região.`;
  } else {
    linhaEco = `Estimativa em ${meses} meses: ${dizer(eco(f.base))}.`;
  }
  const sim = f.base;
  const mensal = f.variavel
    ? `${brl(f.melhor.novoValorPrimeiroMes)} durante a promoção e depois ${brl(f.melhor.novoValorDepoisDaPromocao)}`
    : brl(sim.novoValorPrimeiroMes);
  const interesses = [];
  if (d.manterNumeros) interesses.push("manter os números");
  if (d.migrarCnpj) interesses.push("migrar da titularidade CPF para CNPJ");
  if (d.fibraNome) interesses.push(`internet fibra (${d.fibraNome})`);
  return [
    `Olá, ${c.primeiroNome}! Fiz uma simulação no site e quero receber minha proposta personalizada.`,
    `Plano: ${d.planoNome}`,
    `Linhas: ${d.linhas}`,
    `Hoje pago: ${brl(sim.valorAtualMensal)} por mês${d.operadora ? ` (${d.operadora})` : ""}`,
    `Mensalidade estimada na Claro: ${mensal}`,
    linhaEco,
    interesses.length ? `Tenho interesse em: ${interesses.join(", ")}.` : "",
    "Pode confirmar as condições comerciais e a elegibilidade?",
  ].filter(Boolean).join("\n");
}

export function msgCobertura(c, { cep, numero, complemento }) {
  return [
    `Olá, ${c.primeiroNome}! Quero consultar se a Claro fibra atende o endereço da minha empresa.`,
    `CEP: ${cep}`,
    `Número: ${numero || "não informado"}`,
    complemento ? `Complemento: ${complemento}` : "",
  ].filter(Boolean).join("\n");
}
