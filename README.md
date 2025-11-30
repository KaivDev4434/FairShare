# FairShare - Smart Bill Splitting

Split bills fairly with roommates. Upload receipts, select what each person had, and let FairShare calculate who owes what.

![FairShare](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-cyan)

## Features

- **Smart Receipt Scanning**: Upload PDFs or photos of bills/invoices
- **AI-Powered Extraction**: Uses Ollama (local) with Perplexity API fallback to extract items
- **Fair Splitting**: Each person selects their items with custom portion support
- **Real-time Calculation**: Dynamic per-person totals including tax/tip distribution
- **Shareable Links**: Share bills with roommates via unique links
- **History Tracking**: Dashboard with running balances and settlement suggestions

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Upload     │───▶│  Docling    │───▶│   Ollama/   │───▶│  Database   │
│  PDF/Image  │    │  OCR+Parse  │    │  Perplexity │    │  (SQLite)   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), TailwindCSS, shadcn/ui |
| Backend | Next.js API Routes |
| OCR/Parsing | Docling (Python microservice) |
| LLM | Ollama (local, primary) + Perplexity API (fallback) |
| Database | SQLite with Prisma ORM |

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+ (for Docling service)
- Ollama with a 7B+ model (optional, for local LLM)
- Perplexity API key (optional, fallback)

### 1. Install Dependencies

```bash
cd fairshare
npm install
```

### 2. Set up Environment Variables

Create a `.env.local` file:

```env
# Ollama (Local LLM - Primary)
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3:8b"

# Perplexity API (Fallback) - Optional
PERPLEXITY_API_KEY="your-api-key"

# Python Docling Service
DOCLING_SERVICE_URL="http://localhost:8000"
```

### 3. Set up the Database

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Start the Docling Service

```bash
cd python-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Or use Docker:

```bash
cd python-service
docker build -t fairshare-docling .
docker run -p 8000:8000 fairshare-docling
```

### 5. Start the Next.js App

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Usage

1. **Upload a Bill**: Drag & drop or click to upload a PDF/image of your receipt
2. **Review Items**: Edit the parsed items if needed, add tax/tip
3. **Share the Link**: Send the unique bill link to your roommates
4. **Select Items**: Each person joins and selects what they had
5. **View Totals**: See real-time per-person totals with fair splits

## LLM Configuration

FairShare uses a **hybrid LLM approach** to minimize costs:

1. **Ollama (Local)**: Free, tries first
2. **Perplexity (Cloud)**: Paid fallback if local fails

Expected cost savings: **80-90%** reduction in API calls.

### Setting up Ollama

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model (8B recommended for bill parsing)
ollama pull llama3:8b

# Or use Mistral
ollama pull mistral:7b
```

Update `OLLAMA_MODEL` in your `.env.local` to match.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/parse` | POST | Upload and parse a document |
| `/api/bills` | GET/POST | List or create bills |
| `/api/bills/[id]` | GET/PATCH/DELETE | Manage a specific bill |
| `/api/bills/[id]/shares` | GET/POST/DELETE | Manage people on a bill |
| `/api/bills/[id]/claims` | POST/PATCH/DELETE | Manage item selections |
| `/api/bills/[id]/calculate` | GET | Calculate per-person splits |

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Reset database
npx prisma migrate reset
```

## License

MIT
