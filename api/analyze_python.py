"""
api/analyze_python.py — Python-Powered Deep Static Analysis Engine

Architecture note: Uses Python 3.12 standard library (ast, re, json, http.server)
to run zero-dependency, ultra-fast static code extraction on Vercel Serverless.

Features:
1. Python AST Parser (Classes, Inheritance, Decorators, Complexity)
2. Multi-Framework API Route Scanner (Express, FastAPI, Flask, Next.js, Spring)
3. DB Schema & ORM Model Detector (Prisma, Mongoose, SQLAlchemy, SQL)
4. Static Security & Risk Scanner (Secrets, Unsafe eval, SQL injection smells)
5. Mermaid API Topology & Class Diagram Generators
"""

from http.server import BaseHTTPRequestHandler
import json
import re
import ast

# ─────────────────────────────────────────────
# 1. AST ANALYZER (Python AST)
# ─────────────────────────────────────────────
class PythonASTAnalyzer:
    def __init__(self, py_files):
        self.files = py_files

    def analyze(self):
        classes = []
        functions = []
        comment_ratios = []

        for file in self.files:
            filename = file.get('name', '')
            content = file.get('content', '')
            if not content.strip():
                continue

            # ── Per-file comment ratio ──
            lines = content.split('\n')
            comment_count = 0
            code_count = 0
            in_block = False
            for line in lines:
                stripped = line.strip()
                if not stripped:
                    continue
                if in_block:
                    comment_count += 1
                    if stripped.endswith('"""') or stripped.endswith("'''"):
                        in_block = False
                    continue
                if stripped.startswith('"""') or stripped.startswith("'''"):
                    comment_count += 1
                    # single-line docstring closes on same line
                    rest = stripped[3:]
                    if not (rest.endswith('"""') or rest.endswith("'''")):
                        in_block = True
                elif stripped.startswith('#'):
                    comment_count += 1
                else:
                    code_count += 1
            total = comment_count + code_count
            ratio = round((comment_count / total * 100), 1) if total > 0 else 0.0
            comment_ratios.append({
                "file": filename,
                "commentLines": comment_count,
                "codeLines": code_count,
                "commentRatio": ratio,
                "documented": ratio >= 10,
            })

            try:
                tree = ast.parse(content, filename=filename)
            except Exception:
                continue

            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    bases = [b.id for b in node.bases if isinstance(b, ast.Name)]
                    methods = [n.name for n in node.body if isinstance(n, ast.FunctionDef)]
                    docstring = ast.get_docstring(node) or ""
                    classes.append({
                        "name": node.name,
                        "file": filename,
                        "bases": bases,
                        "methods": methods,
                        "docstring": docstring[:100]
                    })
                elif isinstance(node, ast.FunctionDef):
                    complexity = self._calc_complexity(node)
                    functions.append({
                        "name": node.name,
                        "file": filename,
                        "line": node.lineno,
                        "args": [a.arg for a in node.args.args],
                        "complexity": complexity
                    })

        return {"classes": classes, "functions": functions, "commentRatios": comment_ratios}

    def _calc_complexity(self, fn_node):
        """Calculate Cyclomatic Complexity for Python function node"""
        complexity = 1
        for node in ast.walk(fn_node):
            if isinstance(node, (ast.If, ast.For, ast.While, ast.ExceptHandler, ast.With, ast.Assert)):
                complexity += 1
            elif isinstance(node, ast.BoolOp):
                complexity += len(node.values) - 1
        return complexity


# ─────────────────────────────────────────────
# 2. ROUTE SCANNER
# ─────────────────────────────────────────────
class RouteScanner:
    def __init__(self, files):
        self.files = files

    def scan(self):
        routes = []
        patterns = [
            # Express.js / Node: app.get('/api/users', ...), router.post('/checkout', ...)
            (r'(?:app|router)\.(get|post|put|delete|patch|all)\s*\(\s*[\'"`]([^\'"`]+)[\'"`]', 'Express.js'),
            # FastAPI / Flask: @app.get("/api/v1/items"), @router.post("/login")
            (r'@(?:app|router|api_router)\.(get|post|put|delete|patch)\s*\(\s*[\'"`]([^\'"`]+)[\'"`]', 'FastAPI/Flask'),
            # Spring Boot: @GetMapping("/users"), @PostMapping("/orders")
            (r'@(Get|Post|Put|Delete|Request)Mapping\s*\(\s*(?:value\s*=\s*)?[\'"`]([^\'"`]+)[\'"`]', 'Spring Boot'),
            # Go Gin/Fiber: r.GET("/ping", ...), app.Post("/api/data", ...)
            (r'\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*[\'"`]([^\'"`]+)[\'"`]', 'Go HTTP'),
        ]

        for file in self.files:
            filename = file.get('name', '')
            content = file.get('content', '')

            # Check for Next.js App Router API routes: app/api/.../route.ts
            if re.search(r'app/api/.+?/route\.(js|ts)', filename.replace('\\', '/')):
                route_path = '/' + filename.replace('\\', '/').split('app/')[-1].replace('/route.ts', '').replace('/route.js', '')
                for method in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']:
                    if re.search(r'export\s+(?:async\s+)?function\s+' + method, content):
                        routes.append({
                            "method": method,
                            "path": route_path,
                            "file": filename,
                            "framework": "Next.js Route Handler"
                        })

            for pattern, framework in patterns:
                for match in re.finditer(pattern, content, re.IGNORECASE):
                    method = match.group(1).upper()
                    path = match.group(2)
                    routes.append({
                        "method": method,
                        "path": path,
                        "file": filename,
                        "framework": framework
                    })

        # Deduplicate routes
        seen = set()
        unique_routes = []
        for r in routes:
            key = f"{r['method']}:{r['path']}:{r['file']}"
            if key not in seen:
                seen.add(key)
                unique_routes.append(r)

        return unique_routes


# ─────────────────────────────────────────────
# 3. SCHEMA & DB DETECTOR
# ─────────────────────────────────────────────
class SchemaDetector:
    def __init__(self, files):
        self.files = files

    def detect(self):
        schemas = []

        for file in self.files:
            filename = file.get('name', '')
            content = file.get('content', '')

            # 1. Prisma Schema: model User { id String @id }
            if filename.endswith('.prisma') or 'model ' in content:
                for m in re.finditer(r'model\s+(\w+)\s*\{([^}]+)\}', content):
                    model_name = m.group(1)
                    body = m.group(2)
                    fields = [line.strip().split()[0] for line in body.split('\n') if line.strip() and not line.strip().startsWith('//') and not line.strip().startswith('@@')]
                    schemas.append({
                        "name": model_name,
                        "type": "Prisma ORM",
                        "file": filename,
                        "fields": fields[:8]
                    })

            # 2. SQL CREATE TABLE: CREATE TABLE users (id INT, name VARCHAR)
            for m in re.finditer(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"\w]+)\s*\(([^;]+)\)', content, re.IGNORECASE):
                table_name = m.group(1).replace('`', '').replace('"', '')
                body = m.group(2)
                fields = []
                for line in body.split(','):
                    parts = line.strip().split()
                    if parts and not parts[0].upper() in ['PRIMARY', 'FOREIGN', 'CONSTRAINT', 'KEY', 'UNIQUE']:
                        fields.append(parts[0].replace('`', '').replace('"', ''))
                schemas.append({
                    "name": table_name,
                    "type": "SQL Database Table",
                    "file": filename,
                    "fields": fields[:8]
                })

            # 3. SQLAlchemy / Django Model: class User(Base): __tablename__ = 'users'
            for m in re.finditer(r'class\s+(\w+)\s*\((?:Base|models\.Model|db\.Model)\):', content):
                schemas.append({
                    "name": m.group(1),
                    "type": "Python ORM Model",
                    "file": filename,
                    "fields": ["id", "created_at", "updated_at"]
                })

        return schemas[:15]


# ─────────────────────────────────────────────
# 4. SECURITY & RISK SCANNER
# ─────────────────────────────────────────────
class SecurityScanner:
    def __init__(self, files):
        self.files = files

    def scan(self):
        issues = []

        rules = [
            (r'(?:api[_-]?key|secret[_-]?key|access[_-]?token|password)\s*=\s*[\'"`][A-Za-z0-9_\-]{16,}[\'"`]', 'High', 'Potential Hardcoded API Secret / Key'),
            (r'eval\s*\([^)]+\)', 'High', 'Use of Unsafe eval() Function'),
            (r'SELECT\s+.*?\s+FROM\s+.*?\+\s*\w+', 'High', 'Potential Raw SQL String Concatenation (SQL Injection Risk)'),
            (r'rejectUnauthorized\s*:\s*false', 'Medium', 'Disabled SSL Certificate Validation (rejectUnauthorized: false)'),
            (r'cors\s*\(\s*\{\s*origin\s*:\s*[\'"`]\*[\'"`]\s*\}\s*\)', 'Low', 'Permissive Global CORS Config (origin: "*")'),
            (r'process\.env\.[A-Z0-9_]+', 'Info', 'Environment Variable Access'),
            # Extended rules
            (r'pickle\.loads?\s*\(', 'High', 'Insecure Deserialization via pickle.loads()'),
            (r'subprocess\.(call|run|Popen)\s*\(.*shell\s*=\s*True', 'High', 'Shell Injection Risk: subprocess with shell=True'),
            (r'DEBUG\s*=\s*True', 'Medium', 'Debug Mode Enabled (should be False in production)'),
            (r'(?:JWT_SECRET|SECRET_KEY|PRIVATE_KEY)\s*=\s*[\'"`][^\'"` ]{8,}[\'"`]', 'High', 'Hardcoded JWT / Secret Key'),
        ]

        for file in self.files:
            filename = file.get('name', '')
            content = file.get('content', '')
            lines = content.split('\n')

            for pattern, severity, desc in rules:
                for idx, line in enumerate(lines, 1):
                    if re.search(pattern, line, re.IGNORECASE):
                        # Ignore false positives in documentation/comments
                        trimmed = line.strip()
                        if trimmed.startswith('//') or trimmed.startswith('#') or trimmed.startswith('*'):
                            continue
                        issues.append({
                            "severity": severity,
                            "rule": desc,
                            "file": filename,
                            "line": idx,
                            "snippet": trimmed[:80]
                        })
                        if len(issues) >= 20:
                            break

        return issues[:20]


# ─────────────────────────────────────────────
# 5. DIAGRAM BUILDER (Topology & Class Graph)
# ─────────────────────────────────────────────
class PythonDiagramBuilder:
    def build_api_topology(self, routes, schemas):
        if not routes and not schemas:
            return 'graph LR\n  Client["🌐 Web Client"] --> API["⚡ API Layer"]'

        lines = ['graph LR']
        lines.append('  subgraph ClientTier ["🌐 Client Tier"]')
        lines.append('    Client["Frontend Application"]')
        lines.append('  end')

        if routes:
            lines.append('  subgraph Endpoints ["⚡ API Gateway & Endpoints"]')
            for idx, r in enumerate(routes[:10]):
                r_id = f"R_{idx}"
                lines.append(f'    {r_id}["{r["method"]} {r["path"]}"]')
            lines.append('  end')

        if schemas:
            lines.append('  subgraph DatabaseTier ["🗄️ Data Storage Tier"]')
            for idx, s in enumerate(schemas[:6]):
                s_id = f"DB_{idx}"
                lines.append(f'    {s_id}[("{s.get("type", "DB")}: {s.get("name", "Table")}")]')
            lines.append('  end')

        for idx in range(min(len(routes), 10)):
            lines.append(f'  Client --> R_{idx}')

        for idx, s in enumerate(schemas[:6]):
            if routes:
                target_idx = idx % min(len(routes), 5)
                lines.append(f'  R_{target_idx} -.-> DB_{idx}')

        return '\n'.join(lines)


# ─────────────────────────────────────────────
# 6. ANTI-PATTERN & CODE SMELL SCANNER
# ─────────────────────────────────────────────
class AntiPatternScanner:
    def __init__(self, files):
        self.files = files

    def scan(self):
        issues = []
        for file in self.files:
            filename = file.get('name', '')
            content = file.get('content', '')
            if not content.strip():
                continue

            # Python AST Checks
            if filename.endswith('.py'):
                try:
                    tree = ast.parse(content, filename=filename)
                    issues.extend(self._scan_python_ast(tree, filename, content))
                except Exception:
                    pass

            # Cross-language Regex smells
            issues.extend(self._scan_generic(filename, content))

        return issues[:25]

    def _scan_python_ast(self, tree, filename, content):
        items = []
        for node in ast.walk(tree):
            # 1. Mutable default arguments
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                for default in node.args.defaults:
                    if isinstance(default, (ast.List, ast.Dict, ast.Set)):
                        items.append({
                            "file": filename,
                            "line": node.lineno,
                            "type": "Mutable Default Argument",
                            "severity": "High",
                            "message": f"Function '{node.name}' uses a mutable default argument (list/dict/set). State will persist across invocations.",
                            "snippet": f"def {node.name}(...)"
                        })

                # Deep nesting check
                depth = self._get_max_depth(node)
                if depth >= 5:
                    items.append({
                        "file": filename,
                        "line": node.lineno,
                        "type": "Deep Nesting / Cognitive Overload",
                        "severity": "Medium",
                        "message": f"Function '{node.name}' has nesting depth of {depth} levels. Consider extracting helper functions.",
                        "snippet": f"def {node.name}() [Depth: {depth}]"
                    })

            # 2. Wildcard imports
            elif isinstance(node, ast.ImportFrom):
                for alias in node.names:
                    if alias.name == '*':
                        items.append({
                            "file": filename,
                            "line": node.lineno,
                            "type": "Wildcard Import",
                            "severity": "Medium",
                            "message": f"Wildcard 'from {node.module} import *' pollutes the global namespace.",
                            "snippet": f"from {node.module} import *"
                        })

            # 3. Broad Exception swallowed silently
            elif isinstance(node, ast.ExceptHandler):
                is_broad = node.type is None or (isinstance(node.type, ast.Name) and node.type.id in ['Exception', 'BaseException'])
                is_silent = len(node.body) == 1 and isinstance(node.body[0], ast.Pass)
                if is_broad and is_silent:
                    items.append({
                        "file": filename,
                        "line": node.lineno,
                        "type": "Swallowed Exception",
                        "severity": "High",
                        "message": "Broad exception caught with silent 'pass' statement, masking runtime bugs.",
                        "snippet": "except Exception: pass"
                    })

            # 4. Synchronous blocking call inside async function
            elif isinstance(node, ast.AsyncFunctionDef):
                for sub in ast.walk(node):
                    if isinstance(sub, ast.Call):
                        fn_name = ""
                        if isinstance(sub.func, ast.Attribute):
                            val_id = getattr(sub.func.value, 'id', '')
                            fn_name = f"{val_id}.{sub.func.attr}"
                        elif isinstance(sub.func, ast.Name):
                            fn_name = sub.func.id

                        if fn_name in ['time.sleep', 'requests.get', 'requests.post', 'urllib.request.urlopen']:
                            items.append({
                                "file": filename,
                                "line": sub.lineno,
                                "type": "Blocking Call in Async Def",
                                "severity": "High",
                                "message": f"Blocking call '{fn_name}()' blocks the event loop in async def '{node.name}'. Use 'asyncio.sleep' or async client.",
                                "snippet": f"{fn_name}()"
                            })
        return items

    def _get_max_depth(self, node, current_depth=0):
        max_d = current_depth
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.If, ast.For, ast.While, ast.Try, ast.With)):
                max_d = max(max_d, self._get_max_depth(child, current_depth + 1))
            else:
                max_d = max(max_d, self._get_max_depth(child, current_depth))
        return max_d

    def _scan_generic(self, filename, content):
        items = []
        # Check for console.log in production JS/TS
        if filename.endswith(('.js', '.ts', '.jsx', '.tsx')) and not 'test' in filename.lower():
            if 'console.log(' in content:
                items.append({
                    "file": filename,
                    "line": 1,
                    "type": "Residual Debug Logging",
                    "severity": "Low",
                    "message": "File contains 'console.log' statements which can degrade production performance.",
                    "snippet": "console.log(...)"
                })
        return items


# ─────────────────────────────────────────────
# 7. CIRCULAR DEPENDENCY SCANNER (DFS Graph Cycle Detection)
# ─────────────────────────────────────────────
class CircularDependencyScanner:
    def __init__(self, files):
        self.files = files

    def scan(self):
        graph = {}
        file_map = {f.get('name', ''): f.get('content', '') for f in self.files}

        # Build adjacency list
        for fname, content in file_map.items():
            graph[fname] = []
            if not content.strip():
                continue

            # Python imports
            for m in re.finditer(r'(?:from|import)\s+([\w\.]+)', content):
                mod_name = m.group(1).split('.')[0]
                for candidate in file_map.keys():
                    if candidate != fname and candidate.endswith(('.py', '.js', '.ts', '.jsx', '.tsx')):
                        c_base = candidate.split('/')[-1].split('.')[0]
                        if mod_name == c_base:
                            graph[fname].append(candidate)

            # JS/TS imports
            for m in re.finditer(r'(?:import\s+.*?from\s+[\'"]|require\s*\(\s*[\'"])([\.\/\w\-_]+)[\'"]', content):
                target = m.group(1).split('/')[-1].split('.')[0]
                for candidate in file_map.keys():
                    if candidate != fname and candidate.endswith(('.js', '.ts', '.jsx', '.tsx', '.vue')):
                        c_base = candidate.split('/')[-1].split('.')[0]
                        if target == c_base:
                            graph[fname].append(candidate)

        # Deduplicate edges
        for k in graph:
            graph[k] = list(set(graph[k]))

        # DFS Cycle Detection
        cycles = []
        visited = set()
        rec_stack = []

        def dfs(node):
            visited.add(node)
            rec_stack.append(node)

            for neighbor in graph.get(node, []):
                if neighbor not in visited:
                    dfs(neighbor)
                elif neighbor in rec_stack:
                    idx = rec_stack.index(neighbor)
                    cycle_chain = rec_stack[idx:] + [neighbor]
                    if len(cycle_chain) > 2 and cycle_chain not in cycles:
                        cycles.append(cycle_chain)

            rec_stack.pop()

        for node in list(graph.keys()):
            if node not in visited:
                dfs(node)

        # Format output
        results = []
        for c in cycles[:10]:
            clean_names = [f.split('/')[-1] for f in c]
            results.append({
                "chain": clean_names,
                "fullPaths": c,
                "length": len(c) - 1,
                "severity": "High" if len(c) <= 3 else "Medium",
                "summary": " ➔ ".join(clean_names)
            })

        return results


# ─────────────────────────────────────────────
# 8. REFACTORING HOTSPOT CALCULATOR
# ─────────────────────────────────────────────
class HotspotCalculator:
    def __init__(self, files, ast_results):
        self.files = files
        self.ast_results = ast_results

    def calculate(self):
        hotspots = []
        function_complexity_map = {}

        for fn in self.ast_results.get('functions', []):
            f_name = fn.get('file', '')
            function_complexity_map[f_name] = function_complexity_map.get(f_name, 0) + fn.get('complexity', 1)

        for file in self.files:
            filename = file.get('name', '')
            content = file.get('content', '')
            if not content.strip() or filename.endswith(('.json', '.md', '.lock', '.svg', '.png')):
                continue

            lines = [l for l in content.split('\n') if l.strip()]
            loc = len(lines)
            complexity = function_complexity_map.get(filename, max(1, loc // 30))

            # Risk Score formula: (Complexity * 3) + (LOC / 15)
            risk_score = round((complexity * 3.5) + (loc / 12), 1)

            if loc > 50 or complexity > 5:
                # Determine recommendation
                rec = "Module size and structure look manageable."
                if loc > 250 and complexity > 15:
                    rec = "Urgent: High complexity and size. Decompose into smaller single-responsibility services."
                elif loc > 200:
                    rec = "Large file length. Extract shared sub-components or utility helpers."
                elif complexity > 10:
                    rec = "High cyclomatic complexity. Simplify nested branching logic and condition trees."

                hotspots.append({
                    "file": filename,
                    "shortName": filename.split('/')[-1],
                    "loc": loc,
                    "complexity": complexity,
                    "riskScore": risk_score,
                    "priority": "Critical" if risk_score > 60 else "Moderate" if risk_score > 30 else "Low",
                    "recommendation": rec
                })

        hotspots.sort(key=lambda x: x['riskScore'], reverse=True)
        return hotspots[:8]


# ─────────────────────────────────────────────
# VERCEL SERVERLESS HANDLER
# ─────────────────────────────────────────────
class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)

        try:
            body = json.loads(post_data.decode('utf-8'))
            files = body.get('files', [])

            if not isinstance(files, list) or len(files) == 0:
                self._send_json({"error": "No files provided"}, 400)
                return

            py_files = [f for f in files if f.get('name', '').endswith('.py')]

            ast_results  = PythonASTAnalyzer(py_files).analyze() if py_files else {"classes": [], "functions": []}
            routes       = RouteScanner(files).scan()
            schemas      = SchemaDetector(files).detect()
            security     = SecurityScanner(files).scan()
            anti_patterns = AntiPatternScanner(files).scan()
            cycles       = CircularDependencyScanner(files).scan()
            hotspots     = HotspotCalculator(files, ast_results).calculate()

            diagram_builder = PythonDiagramBuilder()
            api_topology    = diagram_builder.build_api_topology(routes, schemas)

            response_payload = {
                "pythonAST": ast_results,
                "apiRoutes": routes,
                "databaseSchemas": schemas,
                "securityIssues": security,
                "antiPatterns": anti_patterns,
                "circularDependencies": cycles,
                "hotspots": hotspots,
                "apiTopologyDiagram": api_topology,
                "totalPythonFiles": len(py_files)
            }

            self._send_json(response_payload, 200)

        except Exception as e:
            self._send_json({"error": "Python analysis failed", "details": str(e)}, 500)

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

