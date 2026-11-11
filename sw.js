// Service worker do site. Guarda uma cópia para abrir mais rápido e funcionar com internet fraca.
// Nunca guarda o vídeo. A versão muda sozinha quando o site muda.
const VERSAO = "claro-2fa807e9";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (req.headers.has("range") || url.pathname.endsWith(".mp4")) return;

  const preferirRede = req.mode === "navigate" || url.pathname.endsWith(".json");
  evento.respondWith(
    caches.open(VERSAO).then(async (cache) => {
      const guardada = await cache.match(req);
      const rede = fetch(req).then((resp) => {
        if (resp.ok) cache.put(req, resp.clone());
        return resp;
      }).catch(() => null);
      if (preferirRede) return (await rede) || guardada || Response.error();
      return guardada || (await rede) || Response.error();
    })
  );
});
