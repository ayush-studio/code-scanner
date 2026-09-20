// src/data/demoProjects.js
/**
 * Curated Demo Datasets for instant 1-click preview on CodeScanner.
 * Enables zero-friction evaluation of the tool on public deployments.
 */

export const DEMO_PROJECTS = [
  {
    id: 'express-prisma-api',
    title: 'Express + Prisma E-Commerce API',
    badge: 'TypeScript · Node.js',
    desc: 'Production REST API featuring Prisma ORM, JWT authentication, and Stripe checkout pipelines.',
    icon: '📦',
    result: {
      metrics: {
        totalFiles: 24,
        totalLines: 3120,
        byLanguage: { ts: 2450, prisma: 420, json: 250 }
      },
      requirements: {
        commands: ['npm install', 'npx prisma generate', 'npm run dev'],
        dependencies: [
          { name: '@prisma/client', version: '^5.10.0', source: 'package.json' },
          { name: 'express', version: '^4.19.2', source: 'package.json' },
          { name: 'jsonwebtoken', version: '^9.0.2', source: 'package.json' },
          { name: 'bcryptjs', version: '^2.4.3', source: 'package.json' },
          { name: 'zod', version: '^3.22.4', source: 'package.json' }
        ]
      },
      hld: `graph TD
  Client["🌐 Web Client"] --> Gateway["⚡ Express Server"]
  Gateway --> AuthMiddleware["🛡️ Auth & JWT Guard"]
  AuthMiddleware --> Routes["🚏 Route Handlers"]
  Routes --> Services["⚙️ Business Services"]
  Services --> PrismaClient["🗄️ Prisma ORM"]
  PrismaClient --> Postgres[("🐘 PostgreSQL DB")]`,
      lld: `classDiagram
  class AuthService {
    +login(email, password)
    +register(data)
    +verifyToken(jwt)
  }
  class ProductController {
    +listProducts(query)
    +getProductById(id)
    +createProduct(payload)
  }
  class OrderService {
    +checkout(cartId)
    +cancelOrder(orderId)
  }
  ProductController --> OrderService
  AuthService --> OrderService`,
      lineage: `graph LR
  server_ts["server.ts"] --> app_ts["app.ts"]
  app_ts --> auth_route["routes/auth.route.ts"]
  app_ts --> product_route["routes/product.route.ts"]
  auth_route --> auth_service["services/auth.service.ts"]
  product_route --> product_service["services/product.service.ts"]
  auth_service --> prisma_client["db/prisma.ts"]
  product_service --> prisma_client["db/prisma.ts"]`,
      scorecard: {
        score: 94,
        grade: 'A',
        color: 'emerald',
        breakdown: {
          securityScore: 28,
          complexityScore: 19,
          duplicationScore: 19,
          deadCodeScore: 14,
          testScore: 14
        },
        recommendations: [
          { type: 'info', text: 'Consider enabling rate-limiting on /api/auth/login route.' }
        ]
      },
      pythonAnalysis: {
        apiRoutes: [
          { method: 'POST', path: '/api/auth/login', file: 'routes/auth.route.ts', framework: 'Express.js' },
          { method: 'POST', path: '/api/auth/register', file: 'routes/auth.route.ts', framework: 'Express.js' },
          { method: 'GET', path: '/api/products', file: 'routes/product.route.ts', framework: 'Express.js' },
          { method: 'GET', path: '/api/products/:id', file: 'routes/product.route.ts', framework: 'Express.js' },
          { method: 'POST', path: '/api/orders/checkout', file: 'routes/order.route.ts', framework: 'Express.js' },
        ],
        databaseSchemas: [
          { name: 'User', type: 'Prisma ORM', file: 'prisma/schema.prisma', fields: ['id', 'email', 'passwordHash', 'role', 'createdAt'] },
          { name: 'Product', type: 'Prisma ORM', file: 'prisma/schema.prisma', fields: ['id', 'title', 'price', 'inventory', 'sku'] },
          { name: 'Order', type: 'Prisma ORM', file: 'prisma/schema.prisma', fields: ['id', 'userId', 'totalAmount', 'status'] },
        ],
        securityIssues: [],
        antiPatterns: [],
        circularDependencies: [],
        hotspots: [
          { file: 'services/order.service.ts', shortName: 'order.service.ts', loc: 240, complexity: 12, riskScore: 52.0, priority: 'Moderate', recommendation: 'Order transaction processing has high branching complexity.' }
        ],
        apiTopologyDiagram: `graph LR
  Client["🌐 Web Client"] --> R_0["POST /api/auth/login"]
  Client --> R_1["POST /api/orders/checkout"]
  Client --> R_2["GET /api/products"]
  R_0 -.-> DB_0[("🗄️ Prisma: User")]
  R_1 -.-> DB_1[("🗄️ Prisma: Order")]
  R_2 -.-> DB_2[("🗄️ Prisma: Product")]`
      },
      rawFiles: [
        { name: 'src/server.ts', content: `import app from './app';\nconst PORT = 4000;\napp.listen(PORT, () => console.log('Server online'));` },
        { name: 'src/app.ts', content: `import express from 'express';\nimport authRouter from './routes/auth.route';\nimport productRouter from './routes/product.route';\nconst app = express();\napp.use('/api/auth', authRouter);\napp.use('/api/products', productRouter);\nexport default app;` },
        { name: 'src/routes/auth.route.ts', content: `import { Router } from 'express';\nimport { AuthService } from '../services/auth.service';\nconst router = Router();\nrouter.post('/login', AuthService.login);\nrouter.post('/register', AuthService.register);\nexport default router;` },
        { name: 'src/routes/product.route.ts', content: `import { Router } from 'express';\nimport { ProductService } from '../services/product.service';\nconst router = Router();\nrouter.get('/', ProductService.list);\nrouter.get('/:id', ProductService.getById);\nexport default router;` },
        { name: 'src/services/auth.service.ts', content: `import { prisma } from '../db/prisma';\nexport class AuthService {\n  static async login(req, res) { return res.json({ token: 'jwt' }); }\n  static async register(req, res) { return res.json({ id: 1 }); }\n}` },
        { name: 'src/services/product.service.ts', content: `import { prisma } from '../db/prisma';\nexport class ProductService {\n  static async list(req, res) { return res.json([]); }\n  static async getById(req, res) { return res.json({ id: req.params.id }); }\n}` },
        { name: 'src/services/order.service.ts', content: `import { prisma } from '../db/prisma';\nexport class OrderService {\n  static async checkout(cartId) { return { status: 'paid' }; }\n}` },
        { name: 'src/db/prisma.ts', content: `import { PrismaClient } from '@prisma/client';\nexport const prisma = new PrismaClient();` },
        { name: 'prisma/schema.prisma', content: `model User { id String @id email String @unique }\nmodel Product { id String @id title String price Float }\nmodel Order { id String @id total Float }` }
      ],
      deadCode: { unusedExports: [], totalUnusedExports: 0, orphanFiles: [], totalOrphanFiles: 0 },
      duplication: { duplicationPercentage: 1.2, totalDuplicateLines: 24, duplicateBlocks: [] },
      licenseAudit: { dependencies: [{ name: 'express', license: 'MIT', risk: 'Low' }], complianceStatus: 'Compliant' },
      structureTree: {
        name: 'express-prisma-api',
        type: 'folder',
        children: [
          { name: 'src', type: 'folder', children: [{ name: 'server.ts', type: 'file' }, { name: 'app.ts', type: 'file' }] }
        ]
      }
    }
  },
  {
    id: 'fastapi-microservice',
    title: 'FastAPI Clean Architecture Service',
    badge: 'Python 3.12 · Async',
    desc: 'High-performance Python backend with Pydantic validation, dependency injection, and SQLAlchemy.',
    icon: '🐍',
    result: {
      metrics: {
        totalFiles: 18,
        totalLines: 2180,
        byLanguage: { py: 1950, toml: 120, sql: 110 }
      },
      requirements: {
        commands: ['pip install -r requirements.txt', 'uvicorn app.main:app --reload'],
        dependencies: [
          { name: 'fastapi', version: '==0.110.0', source: 'requirements.txt' },
          { name: 'uvicorn', version: '==0.28.0', source: 'requirements.txt' },
          { name: 'sqlalchemy', version: '==2.0.28', source: 'requirements.txt' },
          { name: 'pydantic', version: '==2.6.4', source: 'requirements.txt' }
        ]
      },
      hld: `graph TD
  Client["🌐 HTTP Client"] --> FastAPI["⚡ FastAPI Router"]
  FastAPI --> Dependencies["💉 Depends() Dependency Injection"]
  Dependencies --> Repositories["📦 Repository Layer"]
  Repositories --> SQLAlchemy[("🗄️ SQLAlchemy Core")]`,
      lld: `classDiagram
  class ItemRepository {
    +get_by_id(id: int)
    +create(data: ItemCreate)
  }
  class SecurityService {
    +get_current_user(token: str)
    +hash_password(raw: str)
  }`,
      lineage: `graph LR
  main_py["main.py"] --> api_router["api/v1/router.py"]
  api_router --> items_py["api/v1/items.py"]
  items_py --> crud_py["crud/item.py"]
  crud_py --> db_session["db/session.py"]`,
      scorecard: {
        score: 97,
        grade: 'A+',
        color: 'emerald',
        breakdown: { securityScore: 30, complexityScore: 20, duplicationScore: 20, deadCodeScore: 15, testScore: 12 },
        recommendations: [{ type: 'success', text: 'Clean functional layout with typed Pydantic models.' }]
      },
      pythonAnalysis: {
        apiRoutes: [
          { method: 'GET', path: '/api/v1/items', file: 'api/v1/items.py', framework: 'FastAPI/Flask' },
          { method: 'POST', path: '/api/v1/items', file: 'api/v1/items.py', framework: 'FastAPI/Flask' },
          { method: 'GET', path: '/api/v1/users/me', file: 'api/v1/users.py', framework: 'FastAPI/Flask' }
        ],
        databaseSchemas: [
          { name: 'Item', type: 'SQLAlchemy / Django Model', file: 'models/item.py', fields: ['id', 'title', 'owner_id', 'created_at'] },
          { name: 'User', type: 'SQLAlchemy / Django Model', file: 'models/user.py', fields: ['id', 'email', 'is_active'] }
        ],
        securityIssues: [],
        antiPatterns: [],
        circularDependencies: [],
        hotspots: [],
        apiTopologyDiagram: `graph LR
  Client["🌐 Web Client"] --> R_0["GET /api/v1/items"]
  Client --> R_1["POST /api/v1/items"]
  R_0 -.-> DB_0[("🗄️ SQLAlchemy: Item")]`
      },
      rawFiles: [
        { name: 'app/main.py', content: `from fastapi import FastAPI\nfrom app.api.router import api_router\napp = FastAPI()\napp.include_router(api_router, prefix="/api/v1")` },
        { name: 'app/api/router.py', content: `from fastapi import APIRouter\nfrom app.api.items import router as items_router\napi_router = APIRouter()\napi_router.include_router(items_router)` },
        { name: 'app/api/items.py', content: `from fastapi import APIRouter, Depends\nfrom app.crud.item import get_items\nrouter = APIRouter()\n@router.get('/items')\ndef list_items(): return get_items()` },
        { name: 'app/crud/item.py', content: `from app.db.session import get_db\ndef get_items(): return [{"id": 1, "title": "Mock item"}]` },
        { name: 'app/db/session.py', content: `def get_db(): yield "db_session"` },
        { name: 'app/models/item.py', content: `class Item(Base):\n    id = Column(Integer, primary_key=True)` }
      ],
      deadCode: { unusedExports: [], totalUnusedExports: 0, orphanFiles: [], totalOrphanFiles: 0 },
      duplication: { duplicationPercentage: 0, totalDuplicateLines: 0, duplicateBlocks: [] },
      licenseAudit: { dependencies: [{ name: 'fastapi', license: 'MIT', risk: 'Low' }], complianceStatus: 'Compliant' },
      structureTree: { name: 'fastapi-service', type: 'folder', children: [] }
    }
  },
  {
    id: 'react-zustand-client',
    title: 'Modern React 19 & Zustand Client',
    badge: 'React 19 · Vite · Tailwind',
    desc: 'SPA client application featuring Zustand state store, responsive glassmorphism, and dynamic charts.',
    icon: '⚛️',
    result: {
      metrics: {
        totalFiles: 22,
        totalLines: 2840,
        byLanguage: { tsx: 1820, ts: 620, css: 400 }
      },
      requirements: {
        commands: ['npm install', 'npm run dev'],
        dependencies: [
          { name: 'react', version: '^19.0.0', source: 'package.json' },
          { name: 'zustand', version: '^5.0.0', source: 'package.json' },
          { name: 'lucide-react', version: '^1.47.0', source: 'package.json' },
          { name: 'tailwindcss', version: '^3.4.0', source: 'package.json' }
        ]
      },
      hld: `graph TD
  Entry["main.tsx"] --> App["App.tsx"]
  App --> Store["🐻 Zustand Global Store"]
  App --> Components["🧩 UI Components"]
  Components --> Services["📡 Axios HTTP API"]`,
      lld: `classDiagram
  class UserStore {
    +user: Object
    +login(creds)
    +logout()
  }`,
      lineage: `graph LR
  main_tsx["main.tsx"] --> app_tsx["App.tsx"]
  app_tsx --> user_store["store/userStore.ts"]
  app_tsx --> navbar["components/Navbar.tsx"]
  app_tsx --> dashboard["pages/Dashboard.tsx"]`,
      scorecard: {
        score: 98,
        grade: 'A+',
        color: 'emerald',
        breakdown: { securityScore: 30, complexityScore: 20, duplicationScore: 20, deadCodeScore: 15, testScore: 13 },
        recommendations: [{ type: 'success', text: 'Clean component tree and atomic state separation.' }]
      },
      pythonAnalysis: {
        apiRoutes: [],
        databaseSchemas: [],
        securityIssues: [],
        antiPatterns: [],
        circularDependencies: [],
        hotspots: [],
        apiTopologyDiagram: `graph LR\n  Client["🌐 React 19 Client"] --> State["🐻 Zustand Store"]`
      },
      rawFiles: [
        { name: 'src/main.tsx', content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nReactDOM.createRoot(document.getElementById('root')!).render(<App />);` },
        { name: 'src/App.tsx', content: `import React from 'react';\nimport Navbar from './components/Navbar';\nimport Dashboard from './pages/Dashboard';\nexport default function App() { return <div><Navbar /><Dashboard /></div>; }` },
        { name: 'src/components/Navbar.tsx', content: `export default function Navbar() { return <nav>CodeScanner</nav>; }` },
        { name: 'src/pages/Dashboard.tsx', content: `import { useUserStore } from '../store/userStore';\nexport default function Dashboard() { return <main>Welcome</main>; }` },
        { name: 'src/store/userStore.ts', content: `import { create } from 'zustand';\nexport const useUserStore = create((set) => ({ user: null }));` }
      ],
      deadCode: { unusedExports: [], totalUnusedExports: 0, orphanFiles: [], totalOrphanFiles: 0 },
      duplication: { duplicationPercentage: 0, totalDuplicateLines: 0, duplicateBlocks: [] },
      licenseAudit: { dependencies: [{ name: 'react', license: 'MIT', risk: 'Low' }], complianceStatus: 'Compliant' },
      structureTree: { name: 'react-app', type: 'folder', children: [] }
    }
  }
];
