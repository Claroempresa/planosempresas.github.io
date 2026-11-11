#!/usr/bin/env python3
"""Gera o site de todos os consultores a partir de UM modelo e UM catálogo.

    python3 scripts/gerar.py

Fonte única (edite só estes):
    fonte/planos.json       catálogo completo, com a página do book e o estado de aprovação
    fonte/consultores.json  quem aparece no site e qual WhatsApp cada um usa
    dados/beneficios.json, dados/faq.json, dados/depoimentos.json
    modelo/index.html       a página (visual)

O que é gerado:
    index.html e <pasta>/index.html de cada consultor, manifest.webmanifest, sw.js,
    sitemap.xml, robots.txt e dados/planos.json (versão pública, sem página do book).

Só vai para o site público o que estiver com "aprovado": true.
"""
import hashlib
import html
import json
import sys
from pathlib import Path
from urllib.parse import quote

RAIZ = Path(__file__).resolve().parent.parent
SITE = "https://claroempresa.github.io/planosempresas.github.io/"
NOME_APP = "Claro Empresas | Consultoria"
CAMPOS = ["id", "nome", "categoria", "pagamento", "fidelidade", "restricoes", "grupoMercado", "dataReferencia", "aprovado", "fonte"]
INTERNOS = {"fonte", "aprovado"}   # nunca vão para o site público


def ler(caminho):
    return json.loads((RAIZ / caminho).read_text(encoding="utf-8"))


def reais(v):
    return "R$ " + f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def validar(planos):
    ids = set()
    for p in planos:
        for c in CAMPOS:
            if c not in p:
                sys.exit(f"Plano {p.get('id')} sem o campo '{c}'.")
        if p["id"] in ids:
            sys.exit(f"Id repetido: {p['id']}")
        ids.add(p["id"])
        if not p["fonte"].get("pagina"):
            sys.exit(f"Plano {p['id']} sem a página do book que o fundamenta.")
    for p in planos:
        for k in ("fibra", "movel"):
            if p["categoria"] == "combo" and p["componentes"][k] not in ids:
                sys.exit(f"Combo {p['id']} aponta para plano inexistente.")


def versao():
    h = hashlib.sha1()
    for pasta in ("css", "js", "dados"):
        for f in sorted((RAIZ / pasta).rglob("*")):
            if f.is_file():
                h.update(f.read_bytes())
    return h.hexdigest()[:8]


def publico(planos):
    saida = []
    for p in planos:
        if p["aprovado"] is True:
            saida.append({k: v for k, v in p.items() if k not in INTERNOS})
    return saida


def montar(modelo, c, ctx):
    pasta = c["pasta"]
    raiz = "" if not pasta else "../"
    url = SITE + (pasta + "/" if pasta else "")
    nome, primeiro = c["nome"], c["primeiroNome"]
    msg = f"Olá, {primeiro}! Vim pelo site e quero falar sobre os planos Claro."
    wa = f"https://wa.me/{c['whatsapp']}?text={quote(msg)}"
    desc = (f"Claro Pós para empresas a partir de {reais(ctx['min_movel'])} por linha, internet fibra a partir de "
            f"{reais(ctx['min_fibra'])} e combos com +50GB de Mega Bônus. No CNPJ o valor fica fixo por 24 meses. Simule sua economia e fale com {nome}, Revenda Autorizada Claro.")
    jsonld = json.dumps({"@context": "https://schema.org", "@graph": [
        {"@type": "WebSite", "name": NOME_APP, "url": url, "inLanguage": "pt-BR"},
        {"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q["p"], "acceptedAnswer": {"@type": "Answer", "text": q["r"]}} for q in ctx["faq"]]},
    ]}, ensure_ascii=False).replace("</", "<\\/")
    dados = {k: c[k] for k in ("nome", "primeiroNome", "whatsapp", "whatsappExibicao")}
    ig = ""
    if c.get("instagram"):
        ig = f'<p><a href="https://www.instagram.com/{c["instagram"]}/" target="_blank" rel="noopener">Instagram @{html.escape(c["instagram"])}</a></p>'
    noscript = "<ul>" + "".join(f"<li>{html.escape(p['nome'])}: {reais(p['valorMensal'])}/mês por linha</li>"
                                for p in ctx["publicos"] if p["categoria"] == "movel") + "</ul>"
    faq = "\n".join(f"          <details><summary>{html.escape(q['p'])}</summary><p>{html.escape(q['r'])}</p></details>" for q in ctx["faq"])
    troca = {
        "RAIZ": raiz, "TITULO": html.escape(f"Planos Claro para a sua empresa | {nome} · Revenda Autorizada Claro"),
        "DESCRICAO": html.escape(desc, quote=True), "URL": url,
        "OG_TITULO": "Planos Claro para a sua empresa | Simule sua economia",
        "OG_DESCRICAO": html.escape(desc, quote=True), "CAPA": SITE + "capa.jpg", "VERSAO": ctx["versao"],
        "JSONLD": jsonld, "CONSULTOR_JSON": json.dumps(dados, ensure_ascii=False).replace("</", "<\\/"),
        "WA_GERAL": wa, "FOTO": c["foto"], "NOME": html.escape(nome), "PRIMEIRO_NOME": html.escape(primeiro),
        "TRATAMENTO": "Sua consultora" if c["feminino"] else "Seu consultor", "WHATS_EXIBICAO": c["whatsappExibicao"],
        "INSTAGRAM_HTML": ig, "PLANOS_NOSCRIPT": noscript, "FAQ_HTML": faq,
    }
    saida = modelo
    for k, v in troca.items():
        saida = saida.replace("{{" + k + "}}", v)
    if "{{" in saida:
        sobra = saida[saida.index("{{"):][:40]
        sys.exit(f"Marcador sem valor no modelo: {sobra!r}")
    return saida


def main():
    planos = ler("fonte/planos.json")
    validar(planos)
    publicos = publico(planos)
    movel = [p["valorMensal"] for p in publicos if p["categoria"] == "movel"]
    fibra = [p["valorMensal"] for p in publicos if p["categoria"] == "fibra"]
    (RAIZ / "dados" / "planos.json").write_text(json.dumps(publicos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    ctx = {"publicos": publicos, "faq": ler("dados/faq.json"), "min_movel": min(movel), "min_fibra": min(fibra), "versao": versao()}
    modelo = (RAIZ / "modelo" / "index.html").read_text(encoding="utf-8")
    consultores = ler("fonte/consultores.json")

    urls = []
    for c in consultores:
        pasta = RAIZ / c["pasta"] if c["pasta"] else RAIZ
        pasta.mkdir(exist_ok=True)
        if not (pasta / c["foto"]).exists():
            sys.exit(f"Falta a foto: {(pasta / c['foto']).relative_to(RAIZ)}")
        (pasta / "index.html").write_text(montar(modelo, c, ctx), encoding="utf-8")
        prefixo = "../" if c["pasta"] else ""
        manifest = {
            "id": "./", "name": NOME_APP, "short_name": "Claro Empresas", "lang": "pt-BR",
            "description": "Planos, benefícios e atendimento Claro Empresas na tela inicial.",
            "start_url": "./", "scope": "./", "display": "standalone",
            "background_color": "#FFFFFF", "theme_color": "#DA291C",
            "icons": [
                {"src": prefixo + "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
                {"src": prefixo + "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
                {"src": prefixo + "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
            ],
        }
        (pasta / "manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        urls.append(SITE + (c["pasta"] + "/" if c["pasta"] else ""))
        print("ok:", urls[-1])

    (RAIZ / "sw.js").write_text((RAIZ / "modelo" / "sw.js").read_text(encoding="utf-8").replace("{{VERSAO}}", ctx["versao"]), encoding="utf-8")
    (RAIZ / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n", encoding="utf-8")
    (RAIZ / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE}sitemap.xml\n", encoding="utf-8")
    print(f"versão {ctx['versao']} · {len(publicos)} itens públicos de {len(planos)}")


if __name__ == "__main__":
    main()
