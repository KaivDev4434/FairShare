<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
</p>

<h1 align="center">FairShare</h1>
<p align="center">
  <strong>Split bills fairly with roommates</strong><br/>
  Upload receipts, select what each person had, and let FairShare calculate who owes what — down to the penny.
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📄 **Smart Receipt Scanning** | Upload PDFs or photos of bills/invoices |
| 🤖 **AI-Powered Extraction** | Uses Ollama (local) with Perplexity API fallback |
| ⚖️ **Fair Splitting** | Each person selects their items with custom portion support |
| 💰 **Penny-Perfect Math** | Uses Largest Remainder Method for exact splits |
| 🔗 **Shareable Links** | Share bills with roommates via unique links |
| 📊 **Dashboard** | View all bills and settlement suggestions |
| 🔓 **Lock/Unlock Bills** | Lock bills when done, unlock to make changes |
| ➕ **Add Items Anytime** | Add items manually even while people are selecting |

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Next.js      │────▶│     Docling     │────▶│     Ollama      │
│    Frontend     │     │   (PDF/OCR)     │     │    (LLM)        │
│    + API        │     │                 │     │                 │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │                     :8000                  :11434
         │
         ▼
┌─────────────────┐
│     SQLite      │
│   (Prisma ORM)  │
└─────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16 (App Router), TailwindCSS 4, shadcn/ui |
| **Backend** | Next.js API Routes |
| **OCR/Parsing** | Docling (Python microservice) |
| **LLM** | Ollama (local) + Perplexity API (fallback) |
| **Database** | SQLite with Prisma ORM |
| **Deployment** | Docker, Cloudflare Tunnel |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker (recommended) or Python 3.11+
- Ollama (optional, for local LLM)

### Option A: Docker (Recommended)

```bash
# Clone the repo
git clone https://github.com/KaivDev4434/FairShare.git
cd FairShare

# Start everything
docker compose up -d

# Access the app
open http://localhost:3001
```

### Option B: Manual Setup

```bash
# 1. Install dependencies
npm install

# 2. Start the Python service
cd python-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000 &

# 3. Start Ollama (optional)
ollama serve &
ollama pull llama3:8b

# 4. Start the app
cd ..
npm run dev
```

---

## 📖 Usage

1. **Upload a Bill** — Drag & drop PDF/image, or enter items manually
2. **Review Items** — Edit parsed items, adjust tax/tip
3. **Share the Link** — Send the unique bill URL to roommates
4. **Select Items** — Each person joins and checks what they had
5. **View Splits** — See real-time per-person totals
6. **Lock Bill** — Lock when done to prevent changes (can unlock later)

---

## 🌐 Self-Hosting

### Home Server with Docker

```bash
# SSH into your server
ssh yourserver

# Clone and run
git clone https://github.com/KaivDev4434/FairShare.git
cd FairShare
docker compose up -d

# Set up external access with Cloudflare Tunnel (free)
docker run -d --name fairshare-tunnel \
  --network fairshare_default \
  --restart unless-stopped \
  cloudflare/cloudflared:latest \
  tunnel --url http://fairshare-app:3000

# Get your public URL
docker logs fairshare-tunnel 2>&1 | grep trycloudflare
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DOCLING_SERVICE_URL` | Document parsing service | `http://localhost:8000` |
| `OLLAMA_BASE_URL` | Ollama LLM service | `http://localhost:11434` |
| `OLLAMA_MODEL` | Model to use | `llama3:8b` |
| `PERPLEXITY_API_KEY` | Fallback LLM API key | - |

---

## 📡 API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/parse` | POST | Parse uploaded document |
| `/api/bills` | GET, POST | List or create bills |
| `/api/bills/[id]` | GET, PATCH, DELETE | Manage a bill |
| `/api/bills/[id]/shares` | GET, POST, DELETE | Manage people on a bill |
| `/api/bills/[id]/claims` | POST, DELETE | Manage item selections |
| `/api/bills/[id]/calculate` | GET | Calculate splits |

---

## 🗺️ Roadmap

### v1.0 — Current Release ✅
- [x] Receipt scanning (PDF/Image)
- [x] AI-powered item extraction
- [x] Fair bill splitting with penny-perfect math
- [x] Shareable bill links
- [x] Dashboard with bill history
- [x] Lock/unlock bills
- [x] Add items manually anytime

### v1.1 — UX Improvements 🔜
- [ ] **Sticky Selected User Total** — Show the selected user's total box pinned at the top
- [ ] **Performance Optimization** — Reduce lag and improve responsiveness

### v2.0 — Planned Features 🚧
- [ ] **User Authentication** — Sign in with email/OAuth
- [ ] **User Profiles** — Track your personal spending history
- [ ] **Groups** — Create groups (e.g., "Roommates", "Trip Friends")
- [ ] **Group Analytics** — See spending patterns within groups
- [ ] **Personal Analytics** — Track your expenses over time

### v3.0 — Future Ideas 💡
- [ ] **Tags & Categories** — Auto/manual categorization of expenses
- [ ] **Recurring Expenses** — Handle monthly bills like utilities
- [ ] **Payment Integration** — Settle up with Venmo/PayPal links
- [ ] **Mobile App** — React Native companion app
- [ ] **Export** — Export to CSV/PDF for records

---

## 🧪 Development

```bash
# Development server
npm run dev

# Build for production
npm run build

# Database management
npx prisma studio        # Visual DB editor
npx prisma db push       # Sync schema
npx prisma migrate reset # Reset DB

# Linting
npm run lint
```

---

## 📁 Project Structure

```
fairshare/
├── src/
│   ├── app/                 # Next.js app router
│   │   ├── api/             # API routes
│   │   ├── bill/[id]/       # Bill detail page
│   │   └── dashboard/       # Dashboard page
│   ├── components/          # React components
│   │   └── ui/              # shadcn/ui components
│   └── lib/                 # Utilities & calculations
├── python-service/          # Docling OCR microservice
├── prisma/                  # Database schema
├── scripts/                 # Utility scripts
└── docker-compose.yml       # Container orchestration
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT © 2024 — Made with ❤️ for fair bill splitting
