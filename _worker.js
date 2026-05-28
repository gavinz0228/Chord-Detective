// ChordDetective — Cloudflare Worker
// Sets COOP/COEP headers for SharedArrayBuffer (needed by ONNX Runtime Web)
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Root → redirect to index_demucs.html
    if (url.pathname === "/" || url.pathname === "") {
      return Response.redirect(url.origin + "/index.html", 302);
    }

    // Serve static asset
    let response;
    try {
      response = await env.ASSETS.fetch(request);
    } catch (e) {
      return new Response("Not found", { status: 404 });
    }

    // Add COOP/COEP headers for SharedArrayBuffer
    const headers = new Headers(response.headers);
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    headers.set("Cross-Origin-Embedder-Policy", "require-corp");

    return new Response(response.body, {
      status: response.status,
      headers
    });
  }
};
