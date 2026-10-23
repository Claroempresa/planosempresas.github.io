"""Gera o site de cada consultor a partir do site da Evelyn (index.html).

Cada consultor ganha uma pasta própria (ex.: everton/) com o mesmo
catálogo, trocando só nome, WhatsApp e foto. Depois de mudar preços ou
textos no index.html, rode de novo:

    python3 gerar_consultores.py

Para adicionar um consultor: inclua um item na lista CONSULTORES e
coloque a foto (quadrada, rosto centralizado) em <pasta>/foto.jpg.
"""

from pathlib import Path

RAIZ = Path(__file__).parent
SITE = "https://planosempresas.github.io/"

CONSULTORES = [
    {
        "pasta": "everton",
        "nome": "Everton Maia",
        "primeiro_nome": "Everton",
        "whatsapp": "5541987482014",          # 55 + DDD + número, só números
        "whatsapp_exibicao": "(41) 98748-2014",
        "feminino": False,
    },
]


def gerar(c):
    html = (RAIZ / "index.html").read_text(encoding="utf-8")
    titulo = "Consultora" if c["feminino"] else "Consultor"
    sua = "Sua consultora" if c["feminino"] else "Seu consultor"

    trocas = [
        # dados da Evelyn -> dados do consultor
        ('var WHATSAPP = "5542998242620";', f'var WHATSAPP = "{c["whatsapp"]}";'),
        ("(42) 99824-2620", c["whatsapp_exibicao"]),
        ("Sua consultora<strong>", f"{sua}<strong>"),
        ("</b> · Consultora · Revenda", f"</b> · {titulo} · Revenda"),
        ("Olá, Evelyn!", f'Olá, {c["primeiro_nome"]}!'),
        ("Evelyn Hartmann", c["nome"]),
        # endereço e arquivos (a pasta do consultor fica um nível abaixo)
        (f'<meta property="og:url" content="{SITE}">',
         f'<meta property="og:url" content="{SITE}{c["pasta"]}/">'),
        ('<img src="retrato.jpg"', '<img src="foto.jpg"'),
        ('src="claro-revenda.png"', 'src="../claro-revenda.png"'),
        ('src="logos/', 'src="../logos/'),
        ("planosempresas.github.io/#", f'planosempresas.github.io/{c["pasta"]}/#'),
    ]
    for antes, depois in trocas:
        if antes not in html:
            raise SystemExit(f"Não encontrei no index.html: {antes!r}")
        html = html.replace(antes, depois)

    sobrou = [linha.strip() for linha in html.splitlines() if "Evelyn" in linha or "99824" in linha]
    if sobrou:
        raise SystemExit("Ainda há dados da Evelyn no site gerado:\n" + "\n".join(sobrou))

    pasta = RAIZ / c["pasta"]
    if not (pasta / "foto.jpg").exists():
        raise SystemExit(f"Falta a foto em {c['pasta']}/foto.jpg")
    (pasta / "index.html").write_text(html, encoding="utf-8")
    print(f"ok: {SITE}{c['pasta']}/")


if __name__ == "__main__":
    for consultor in CONSULTORES:
        gerar(consultor)
