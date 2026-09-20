"""
server.dev.py — Local Development Server for Python Static Analysis Engine

Runs api/analyze_python.py locally on port 3002.
Vite proxies /api/analyze-python → http://localhost:3002/api/analyze-python during dev.
"""

from http.server import HTTPServer
from api.analyze_python import handler

PORT = 3002

if __name__ == '__main__':
    print(f"\n  🐍 Python Static Analysis Dev Server running at http://localhost:{PORT}")
    print(f"  📡 Routes:")
    print(f"     POST /api/analyze-python\n")

    server_address = ('', PORT)
    httpd = HTTPServer(server_address, handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Python API Dev Server...")
        httpd.server_close()
