# FairShare - Smart Bill Splitting

Split bills fairly with roommates. Upload receipts, select what each person had, and let FairShare calculate who owes what — down to the penny.

![Next.js](https://img.shields.io/badge/Next.js-15-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-cyan) ![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- **📄 Smart Receipt Scanning** - Upload PDFs or photos of bills/invoices
- **🤖 AI-Powered Extraction** - Uses Ollama (local) with Perplexity API fallback
- **⚖️ Fair Splitting** - Each person selects their items with custom portion support
- **💰 Penny-Perfect Math** - Uses Largest Remainder Method for exact splits
- **🔗 Shareable Links** - Share bills with roommates via unique links
- **📊 Dashboard** - Running balances and settlement suggestions

## 🏗️ Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Next.js   │───▶│   Docling   │───▶│   Ollama/   │───▶│   SQLite    │
│   Frontend  │    │   (OCR)     │    │  Perplexity │    │  (Prisma)   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
     :3001              :8000           :11434
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router), TailwindCSS 4, shadcn/ui |
| Backend | Next.js API Routes |
| OCR/Parsing | Docling (Python microservice) |
| LLM | Ollama (local) + Perplexity API (fallback) |
| Database | SQLite with Prisma ORM |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Ollama (optional, for local LLM)
- Perplexity API key (optional, for cloud fallback)

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/fairshare.git
cd fairshare
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# Document Parsing Service
DOCLING_SERVICE_URL=http://localhost:8000

# Ollama (Local LLM - Free)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3:8b

# Perplexity API (Fallback - get key at perplexity.ai)
PERPLEXITY_API_KEY=your_api_key_here
```

### 3. Set Up Database

```bash
npx prisma db push
```

### 4. Start the Python Service

```bash
cd python-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### 5. Start the App

```bash
npm run dev
```

Visit **http://localhost:3001**

## 📖 Usage

1. **Upload a Bill** - Drag & drop PDF or image, or enter items manually
2. **Review Items** - Edit parsed items, add tax/tip
3. **Share the Link** - Send the unique bill URL to roommates
4. **Select Items** - Each person joins and checks what they had
5. **View Splits** - See real-time per-person totals with fair distribution

## 🌐 Hosting Options

### Option 1: Free Cloud Hosting (Recommended)

| Service | What to Host | Free Tier |
|---------|--------------|-----------|
| **[Vercel](https://vercel.com)** | Next.js app | Unlimited hobby projects |
| **[Railway](https://railway.app)** | Python service + SQLite | $5/month credit |
| **[Render](https://render.com)** | Python service | 750 hrs/month free |
| **[Fly.io](https://fly.io)** | Both services | 3 shared VMs free |

#### Vercel + Railway Setup

1. **Deploy Next.js to Vercel:**
   ```bash
   npm i -g vercel
   vercel
   ```

2. **Deploy Python service to Railway:**
   - Connect your GitHub repo
   - Railway auto-detects the Dockerfile
   - Set the service URL in Vercel env vars

3. **For LLM:** Use Perplexity API (no self-hosted Ollama needed)

### Option 2: Home Server

Great for privacy and unlimited usage:

```bash
# Run with Docker Compose
docker-compose up -d
```

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3001:3000"
    environment:
      - DOCLING_SERVICE_URL=http://docling:8000
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
    depends_on:
      - docling

  docling:
    build: ./python-service
    ports:
      - "8000:8000"
```

**Pros:** Free, private, can use Ollama locally  
**Cons:** Need to manage uptime, port forwarding for external access

### Option 3: Hybrid (Best of Both)

- Host **Next.js on Vercel** (free, fast CDN)
- Host **Python service + Ollama on home server** with Cloudflare Tunnel
- **Free LLM inference** with Ollama running locally

#### Setup on Home Server

```bash
# SSH into your server
ssh yourserver

# Create FairShare directory
mkdir -p ~/fairshare/python-service

# Copy the Python service files (main.py, requirements.txt, Dockerfile)
# from your local machine

# Run Ollama
docker run -d --name ollama -p 11434:11434 \
  -v ollama_data:/root/.ollama \
  --restart unless-stopped ollama/ollama

# Pull a model
docker exec ollama ollama pull llama3:8b

# Build and run Docling service
cd ~/fairshare/python-service
docker build -t fairshare-docling .
docker run -d --name fairshare-docling -p 8000:8000 \
  --restart unless-stopped fairshare-docling

# Start Cloudflare Tunnels (no account needed)
docker run -d --name docling-tunnel --network host \
  --restart unless-stopped cloudflare/cloudflared:latest \
  tunnel --url http://localhost:8000

docker run -d --name ollama-tunnel --network host \
  --restart unless-stopped cloudflare/cloudflared:latest \
  tunnel --url http://localhost:11434

# Get your tunnel URLs
docker logs docling-tunnel 2>&1 | grep trycloudflare
docker logs ollama-tunnel 2>&1 | grep trycloudflare
```

#### Deploy to Vercel

Set these environment variables in Vercel:

```env
DOCLING_SERVICE_URL=https://your-docling-tunnel.trycloudflare.com
OLLAMA_BASE_URL=https://your-ollama-tunnel.trycloudflare.com
OLLAMA_MODEL=llama3:8b
```

**Note:** Quick tunnels generate random URLs that change on restart. For permanent URLs, create a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) with your Cloudflare account (free tier available)

## 🔧 LLM Configuration

FairShare uses a **hybrid approach** to minimize costs:

1. **Ollama (Local)** - Free, tried first
2. **Perplexity (Cloud)** - Paid fallback if local fails

### Setting up Ollama (Optional)

```bash
# Install
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3:8b

# Verify it's running
curl http://localhost:11434/api/tags
```

**Note:** If you don't have Ollama, just set `PERPLEXITY_API_KEY` and the app will use that directly.

## 📡 API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/parse` | POST | Parse uploaded document |
| `/api/bills` | GET, POST | List or create bills |
| `/api/bills/[id]` | GET, PATCH, DELETE | Manage a bill |
| `/api/bills/[id]/shares` | GET, POST, DELETE | Manage people |
| `/api/bills/[id]/claims` | POST, DELETE | Manage item selections |
| `/api/bills/[id]/calculate` | GET | Calculate splits |

## 🧪 Development

```bash
# Dev server
npm run dev

# Build for production
npm run build && npm start

# Database commands
npx prisma studio     # Visual DB editor
npx prisma db push    # Sync schema
npx prisma migrate reset  # Reset DB

# Lint
npm run lint
```

## 📁 Project Structure

```
fairshare/
├── src/
│   ├── app/              # Next.js app router
│   │   ├── api/          # API routes
│   │   ├── bill/[id]/    # Bill detail page
│   │   └── dashboard/    # Dashboard page
│   ├── components/       # React components
│   └── lib/              # Utilities & calculations
├── python-service/       # Docling OCR service
├── prisma/               # Database schema
└── public/               # Static assets
```

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📄 License

MIT © 2024
