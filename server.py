#!/usr/bin/env python3
"""HTTP server with COOP/COEP headers for SharedArrayBuffer (required by ONNX Runtime Web)."""
import http.server
import os

PORT = 8089
DIR = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()


if __name__ == "__main__":
    print(f"Serving {DIR} on http://localhost:{PORT}")
    print("Headers: COOP=same-origin, COEP=require-corp")
    http.server.HTTPServer(("", PORT), Handler).serve_forever()
