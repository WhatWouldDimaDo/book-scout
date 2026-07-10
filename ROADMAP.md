# Book Scout — Roadmap

## Phase 1: MVP (Shipped)

| Feature | Description | Effort | Dependencies |
|---------|-------------|--------|--------------|
| Branch Picker | Dropdown/combobox to select Fulton County Library branch. | S | BiblioCommons gateway API docs. |
| Paste-List Availability | Paste ISBN, title, or author list → fetch availability across selected branch(es). Displays count of copies, hold queue. | M | BiblioCommons search + availability endpoints. Max 25 items per request (API constraint). |
| AI Recommendations | Paste genres or reading history → Claude Haiku via OpenRouter generates 3–5 recommendations with brief summaries. | M | OpenRouter API setup. Haiku model stable & cost-effective. Rate limit: 10 recs/hour per IP, 200/day global. |
| LocalStorage Wishlist | Add/remove books from a browser-persisted list. No login required. | S | IndexedDB or JSON in localStorage. Serialize/deserialize titles + metadata. |

---

## Phase 2: Near-term (1–2 sprints)

| Feature | Description | Effort | Dependencies |
|---------|-------------|--------|--------------|
| Hold-Placement Deep Links | Generate shareable URLs to jump directly to hold-placement forms on fulcolibrary.bibliocommons.com for each book. | M | BiblioCommons record URL structure reverse-engineering. Test URLs for stability. |
| Shareable Wishlists | Encode wishlist as URL params (compressed JSON). Friends can paste URL to load & compare lists. | M | URL param compression (e.g., lz-string). No server persistence. |
| ISBN Barcode Scanner | Camera input → OCR (Tesseract.js or native mobile APIs) → extract ISBN → check availability. | M | Mobile-first UX. Fallback to manual ISBN entry. Test on iOS/Android. |
| Due-Date Notification | Optional email alerts: "Your hold is ready" / "Due in 3 days." Requires backend (Vercel Function + SMTP or service like SendGrid). | L | Backend: Node.js mail service. Database table: user emails + book holds (violates MVP no-storage rule; ship as opt-in, localStorage tokens only). |
| Kids Mode Taste Profiles | Toggle: simplified UI + age-gated recommendation categories (e.g., Newbery, early readers, middle grade). | M | Config object for kid-safe genre tags. Separate recommendation prompt template for Haiku. |

---

## Phase 3: Later (exploration)

| Feature | Description | Effort | Dependencies |
|---------|-------------|--------|--------------|
| Multi-Library Support | Library slug picker (same BiblioCommons gateway works for 500+ US public libraries). Map-based branch selector across any county. | L | Curated library slug registry. Geographic data. UX complexity for branch pickers across library systems. |
| Shelf Photo Mode | Camera → snap bookstore/personal shelf photo → OCR titles from spines → batch-check Fulton County availability. | L | Image processing (Tesseract.js or Claude Vision via OpenRouter). Spine OCR accuracy ~70–80% in controlled light. |
| Libby & Audiobook Availability | Check OverDrive/Libby audiobook & ebook status alongside print. Unified results view. | M | Libby API reverse-engineering or partnership. Currently undocumented. |
| Reading History & Stats | "Books found this month," heatmap of genres, top branches. Browser-based analytics dashboard. | S | LocalStorage aggregate functions. Chart library (e.g., Recharts). No PII collected. |

---

## Non-Goals

- **User Accounts.** No login, no sign-up. All state is browser-local or URL-encoded.
- **Storing Personal Data.** No server-side database of searches, wishlists, or users. Emails (for Phase 2 notifications) are opt-in tokens, not stored as user profiles.
- **Scraping Behind Authentication.** No username/password harvesting. Only public BiblioCommons gateway API.
