# Agentic / Gen AI UiPath Bot Demo Ideas

> Curated list of UiPath bot demos suitable for an agentic AI interview. Scoped for quick development while demonstrating real understanding of UiPath + GenAI concepts.

---

## 1. Agentic Email Triager & Auto-Responder
**Complexity:** Medium  
**Description:** A bot that reads incoming emails (Outlook/Gmail), sends the subject + body to an LLM (e.g., OpenAI via HTTP Request), classifies the email (inquiry, complaint, follow-up, spam), and drafts a context-aware reply. Can auto-respond or place the draft for human review.  
**Skills shown:** Mail activities, HTTP Request (REST API), JSON parsing, decision logic, agentic reasoning via LLM.

## 2. Intelligent Document Summarizer
**Complexity:** Low-Medium  
**Description:** Picks up documents (PDF/Word) from a folder, extracts text, sends content to an LLM API to generate a concise summary, and writes the summary to an Excel sheet or new file.  
**Skills shown:** File system activities, text extraction, API integration (GenAI), Excel automation.

## 3. Agentic Web Research Assistant
**Complexity:** Medium  
**Description:** Given a topic or company name (via input dialog or Excel), the bot opens a browser, searches Google/Wikipedia, scrapes key information, passes it to an LLM to synthesize a short research brief, and saves the output.  
**Skills shown:** Browser automation, data scraping, LLM API call, agentic task decomposition.

## 4. Smart Invoice Data Extractor with Validation
**Complexity:** Medium  
**Description:** Reads invoice images/PDFs from a folder, uses Document Understanding or LLM to extract fields (vendor, amount, date, invoice number), validates against business rules, and logs results in Excel.  
**Skills shown:** Document Understanding / GenAI extraction, data validation, Excel activities, error handling.

## 5. Conversational FAQ Bot (Attended) ⭐ RECOMMENDED
**Complexity:** Low  
**Description:** An attended bot with an input dialog loop where a user types questions. The bot sends each question to an LLM along with a pre-loaded knowledge base and returns the answer. Acts like a mini chatbot inside UiPath.  
**Skills shown:** Attended automation, loop structures, LLM API integration, prompt engineering, user interaction.

## 6. Resume Screener / Candidate Shortlister
**Complexity:** Medium  
**Description:** Reads resumes (PDFs) from a folder, extracts text, sends each to an LLM with a rating prompt, and compiles results into a ranked Excel sheet.  
**Skills shown:** File handling, PDF text extraction, GenAI integration, Excel reporting, batch processing.

## 7. Agentic Meeting Notes Processor ⭐ RECOMMENDED
**Complexity:** Medium  
**Description:** Picks up meeting notes/transcripts, sends them to an LLM to extract action items, owners, and deadlines, then creates tasks in Excel or sends follow-up emails.  
**Skills shown:** Text processing, LLM-based extraction, structured output parsing, email/Excel automation, agentic workflow.

## 8. Sentiment Analyzer for Customer Reviews
**Complexity:** Low-Medium  
**Description:** Reads customer reviews from Excel or scrapes from a website, sends each to an LLM for sentiment analysis, and generates a summary report in Excel.  
**Skills shown:** Excel read/write, API integration, data transformation, reporting.

## 9. Auto Form Filler with AI Decision-Making
**Complexity:** Medium  
**Description:** Reads data from Excel, opens a web form, fills it in. For ambiguous fields, queries an LLM to infer the best value. Demonstrates agentic decision-making.  
**Skills shown:** Web automation, Excel activities, LLM for decision support, error handling.

## 10. Daily News Digest Generator
**Complexity:** Low-Medium  
**Description:** Scrapes headlines from a news site, sends to an LLM to curate and summarize top stories for a given topic, and emails the digest.  
**Skills shown:** Web scraping, GenAI summarization, email automation.

---

## Top Picks for Quick Interview Demo

| Rank | Option | Why |
|------|--------|-----|
| 1 | **#5 - Conversational FAQ Bot** | Quickest to build, directly demonstrates agentic + GenAI, very interactive for live demo |
| 2 | **#1 - Email Triager** | Relatable enterprise use case, clearly shows agentic reasoning (classify → decide → act) |
| 3 | **#7 - Meeting Notes Processor** | Impressive output, practical use case, shows full agentic loop |
