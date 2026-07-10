"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Library,
  Sparkles,
  BookMarked,
  Sun,
  Moon,
  ExternalLink,
  Plus,
  Trash2,
  Check,
  Loader2,
  Copy,
  AlertCircle,
  Baby,
  Blocks,
  Backpack,
  Bone,
  Rocket,
  Truck,
  Laugh,
  Heart,
  PawPrint,
  Zap,
  Trophy,
  Milk,
  ToyBrick,
  Puzzle,
  Palette,
  Swords,
  Crown,
  BedDouble,
  Type,
  Castle,
  Volleyball,
  Bookmark,
  BookmarkCheck,
  X,
  CheckSquare,
  FileDown,
  Calculator,
  Send,
  ShoppingBag,
} from "lucide-react";
import branches from "@/data/branches.json";
import starterLists from "@/data/starterLists.json";
import { parseBookList } from "@/lib/parseBookList";

const THEME_KEY = "dewey-theme";
const BRANCH_KEY = "dewey-branch";
const WISHLIST_KEY = "dewey-wishlist";
const DEFAULT_BRANCH = "PONCE";

function loadJSON(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable — ignore
  }
}

const LIST_ICONS = {
  "ages-3-5": Baby,
  "ages-6-8": Blocks,
  "ages-9-12": Backpack,
  "age-1": Milk,
  "age-2": ToyBrick,
  "age-3": Puzzle,
  "age-4": Palette,
  dinosaurs: Bone,
  space: Rocket,
  "trucks-things-that-go": Truck,
  "funny-books": Laugh,
  "big-feelings": Heart,
  animals: PawPrint,
  "graphic-novels": Zap,
  "award-winners": Trophy,
  "popular-boys": Swords,
  "popular-girls": Crown,
  bedtime: BedDouble,
  "abc-counting": Type,
  "fairy-tales-princesses": Castle,
  sports: Volleyball,
};

const STATUS_CONFIG = {
  on_shelf: { label: "On Shelf", pillClass: "pill-on-shelf" },
  checked_out: { label: "Checked Out", pillClass: "pill-checked-out" },
  elsewhere: { label: "Elsewhere", pillClass: "pill-elsewhere" },
  not_found: { label: "Not Found", pillClass: "pill-not-found" },
};

const FORMAT_OPTIONS = [
  { id: "print", label: "Print" },
  { id: "ebook", label: "eBook" },
  { id: "audiobook", label: "Audiobook" },
];

function formatDueDate(dueDate) {
  if (!dueDate) return null;
  try {
    return new Date(dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return dueDate;
  }
}

function statusLabelFor(result) {
  const config = STATUS_CONFIG[result.status] || STATUS_CONFIG.not_found;
  if (result.isDigital) {
    if (result.status === "on_shelf") return "Available Now";
    if (result.status === "checked_out") return "Wait List";
  }
  if (result.status === "checked_out" && result.dueDate) {
    return `Checked Out — back ${formatDueDate(result.dueDate)}`;
  }
  if (result.status === "elsewhere") {
    return result.otherBranchCount > 0
      ? `At ${result.otherBranchCount} other branch${result.otherBranchCount === 1 ? "" : "es"}`
      : "Not at this branch";
  }
  return config.label;
}

function StatusPill({ result }) {
  if (!result) return null;
  const config = STATUS_CONFIG[result.status] || STATUS_CONFIG.not_found;
  return <span className={`pill ${config.pillClass}`}>{statusLabelFor(result)}</span>;
}

// Book identity helpers — shared across wishlist toggling, dedupe, and export.
function sameBook(a, b) {
  return (
    (a.title || "").trim().toLowerCase() === (b.title || "").trim().toLowerCase() &&
    (a.author || "").trim().toLowerCase() === (b.author || "").trim().toLowerCase()
  );
}

function bookLine(b) {
  return b.author ? `${b.title} by ${b.author}` : b.title;
}

function amazonSearchUrl(title, author) {
  const q = [title, author].filter(Boolean).join(" ");
  return `https://www.amazon.com/s?k=${encodeURIComponent(q)}`;
}

function priceKey(title, author) {
  return `${(title || "").trim().toLowerCase()}|${(author || "").trim().toLowerCase()}`;
}

// Appends `newLines` to `existingText`, skipping any line already present (case-insensitive).
function dedupeAppend(existingText, newLines) {
  const existingSet = new Set(
    existingText
      .split("\n")
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean)
  );
  const toAdd = newLines.filter((l) => !existingSet.has(l.trim().toLowerCase()));
  if (toAdd.length === 0) return existingText;
  const prefix = existingText && !existingText.endsWith("\n") ? `${existingText}\n` : existingText;
  return prefix + toAdd.join("\n");
}

function resultsToText(results) {
  return results
    .map((r) => {
      const title = r.matchedTitle || r.input;
      const author = r.author || "";
      const parts = [statusLabelFor(r), author ? `${title} by ${author}` : title];
      if (r.callNumber && !r.isDigital) parts.push(r.callNumber);
      return parts.join(" — ");
    })
    .join("\n");
}

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function resultsToCsv(results, priceMap) {
  const header = [
    "input",
    "matchedTitle",
    "author",
    "status",
    "callNumber",
    "dueDate",
    "otherBranchCount",
    "recordUrl",
    "amazonUrl",
    "price",
  ];
  const rows = results.map((r) => {
    const title = r.matchedTitle || r.input;
    const author = r.author || "";
    const priceEntry = priceMap[priceKey(title, author)];
    return [
      r.input,
      r.matchedTitle || "",
      author,
      r.status || "",
      r.callNumber || "",
      r.dueDate || "",
      r.otherBranchCount ?? "",
      r.recordUrl || "",
      amazonSearchUrl(title, author),
      priceEntry?.price ?? "",
    ];
  });
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function wishlistAsResultRows(wishlist) {
  return wishlist.map((b) => ({
    input: b.title,
    matchedTitle: b.title,
    author: b.author,
    status: "",
    callNumber: "",
    dueDate: "",
    otherBranchCount: "",
    recordUrl: "",
  }));
}

function buildStats(results, priceMap) {
  const buckets = {
    on_shelf: { label: "On shelf at my branch", count: 0, sum: 0, unpriced: 0 },
    elsewhere: { label: "At other branches", count: 0, sum: 0, unpriced: 0 },
    checked_out: { label: "Checked out everywhere", count: 0, sum: 0, unpriced: 0 },
    not_found: { label: "Not found", count: 0, sum: 0, unpriced: 0 },
  };
  let buyItAll = 0;
  let freeToday = 0;

  results.forEach((r) => {
    const title = r.matchedTitle || r.input;
    const author = r.author || "";
    const price = priceMap[priceKey(title, author)]?.price ?? null;
    const bucket = buckets[r.status] || buckets.not_found;
    bucket.count += 1;
    if (price != null) {
      bucket.sum += price;
      buyItAll += price;
      if (r.status === "on_shelf") freeToday += price;
    } else {
      bucket.unpriced += 1;
    }
  });

  return { buckets, total: results.length, buyItAll, freeToday };
}

function ResultCard({ result, wishlist, onToggleWishlist }) {
  const title = result.matchedTitle || result.input;
  const author = result.author || "";
  const inWishlist = wishlist.some((b) => sameBook(b, { title, author }));
  return (
    <div className="card">
      <div className="card-row">
        <div className="card-lead">
          {result.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result.coverUrl} alt="" className="cover" loading="lazy" />
          )}
          <div>
            <p className="card-title">{title}</p>
            {author && <p className="card-author">{author}</p>}
          </div>
        </div>
        <button
          className={`btn-icon ${inWishlist ? "active" : ""}`}
          onClick={() => onToggleWishlist({ title, author })}
          title={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
        >
          {inWishlist ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
        </button>
      </div>
      <div className="card-meta">
        <StatusPill result={result} />
        {result.confidence === "verify" && <span className="badge-verify">Verify match</span>}
        {result.callNumber && !result.isDigital && <span>{result.callNumber}</span>}
      </div>
      <div className="card-links">
        {result.recordUrl && (
          <a href={result.recordUrl} target="_blank" rel="noreferrer" className="record-link">
            View record <ExternalLink size={12} />
          </a>
        )}
        <a href={amazonSearchUrl(title, author)} target="_blank" rel="noreferrer" className="amazon-link">
          Amazon <ShoppingBag size={12} />
        </a>
      </div>
    </div>
  );
}

function SkeletonList({ count = 3 }) {
  return (
    <div className="results-list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-card" />
      ))}
    </div>
  );
}

function StarterListPanel({ list, listText, onAdd, onClose }) {
  const [checked, setChecked] = useState(() => list.books.map(() => false));

  function toggle(i) {
    setChecked((prev) => prev.map((c, idx) => (idx === i ? !c : c)));
  }

  function addBooks(books) {
    if (books.length === 0) return;
    onAdd(dedupeAppend(listText, books.map(bookLine)));
    onClose();
  }

  return (
    <div className="starter-panel">
      <div className="starter-panel-header">
        <p className="starter-panel-title">
          {list.label} · {list.books.length} books
        </p>
        <button className="btn-icon" onClick={onClose} title="Close">
          <X size={14} />
        </button>
      </div>
      <div className="starter-panel-list">
        {list.books.map((b, i) => (
          <label key={i} className="starter-panel-item">
            <input type="checkbox" checked={checked[i]} onChange={() => toggle(i)} />
            <span>
              {b.title}
              {b.author && <span className="item-author"> — {b.author}</span>}
            </span>
          </label>
        ))}
      </div>
      <div className="starter-panel-actions">
        <button className="btn btn-secondary" onClick={() => setChecked(list.books.map(() => true))}>
          <CheckSquare size={14} />
          Select all
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => addBooks(list.books.filter((_, i) => checked[i]))}
          disabled={!checked.some(Boolean)}
        >
          <Plus size={14} />
          Add selected to list
        </button>
        <button className="btn btn-primary" onClick={() => addBooks(list.books)}>
          <Plus size={14} />
          Add all
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [theme, setTheme] = useState("light");
  const [branch, setBranch] = useState(DEFAULT_BRANCH);
  const [activeTab, setActiveTab] = useState("check");
  const [wishlist, setWishlist] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [priceMap, setPriceMap] = useState({});

  // Check a List
  const [listText, setListText] = useState("");
  const [checkFormat, setCheckFormat] = useState("print");
  const [checkResults, setCheckResults] = useState(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState(null);
  const [openStarterId, setOpenStarterId] = useState(null);
  const [checkCopyLabel, setCheckCopyLabel] = useState("Copy");

  // Get Recs
  const [recPrompt, setRecPrompt] = useState("");
  const [recResults, setRecResults] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState(null);
  const [recAvailability, setRecAvailability] = useState({});

  // Wishlist checks
  const [wishlistResults, setWishlistResults] = useState(null);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy as text");
  const [wishlistResultsCopyLabel, setWishlistResultsCopyLabel] = useState("Copy");
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsResult, setStatsResult] = useState(null);

  useEffect(() => {
    const storedTheme = loadJSON(THEME_KEY, null);
    if (storedTheme) {
      setTheme(storedTheme);
    } else if (typeof window !== "undefined") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    }
    setBranch(loadJSON(BRANCH_KEY, DEFAULT_BRANCH));
    setWishlist(loadJSON(WISHLIST_KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute("data-theme", theme);
    saveJSON(THEME_KEY, theme);
  }, [theme, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(BRANCH_KEY, branch);
  }, [branch, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(WISHLIST_KEY, wishlist);
  }, [wishlist, hydrated]);

  const toggleWishlist = useCallback((book) => {
    setWishlist((prev) => {
      const exists = prev.some((b) => sameBook(b, book));
      if (exists) return prev.filter((b) => !sameBook(b, book));
      return [...prev, { ...book, addedAt: new Date().toISOString() }];
    });
  }, []);

  const removeFromWishlist = useCallback((index) => {
    setWishlist((prev) => prev.filter((_, i) => i !== index));
  }, []);

  async function runAvailability(books, format = "print") {
    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ books, branch, format }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Availability check failed");
    return data.results;
  }

  async function fetchPrices(books) {
    if (books.length === 0) return [];
    try {
      const res = await fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ books: books.slice(0, 30) }),
      });
      const data = await res.json();
      if (!res.ok) return [];
      return data.results;
    } catch {
      return [];
    }
  }

  async function runCheck(books) {
    if (books.length === 0) return;
    setCheckLoading(true);
    setCheckError(null);
    setCheckResults(null);
    try {
      const results = await runAvailability(books.slice(0, 25), checkFormat);
      setCheckResults(results);
    } catch (err) {
      setCheckError(err.message);
    } finally {
      setCheckLoading(false);
    }
  }

  function handleCheckList() {
    runCheck(parseBookList(listText));
  }

  function copyResults(results, setLabel) {
    navigator.clipboard.writeText(resultsToText(results)).then(() => {
      setLabel("Copied!");
      setTimeout(() => setLabel("Copy"), 1500);
    });
  }

  async function handleGetRecs() {
    if (!recPrompt.trim()) return;
    setRecLoading(true);
    setRecError(null);
    setRecResults(null);
    setRecAvailability({});
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: recPrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't get recommendations");
      setRecResults(data.results);
    } catch (err) {
      setRecError(err.message);
    } finally {
      setRecLoading(false);
    }
  }

  async function checkRecAvailability(index, rec) {
    setRecAvailability((prev) => ({ ...prev, [index]: { loading: true } }));
    try {
      const results = await runAvailability([{ title: rec.title, author: rec.author }]);
      setRecAvailability((prev) => ({ ...prev, [index]: { loading: false, result: results[0] } }));
    } catch {
      setRecAvailability((prev) => ({ ...prev, [index]: { loading: false, error: true } }));
    }
  }

  async function handleCheckWishlist() {
    if (wishlist.length === 0) return;
    setWishlistLoading(true);
    setWishlistResults(null);
    try {
      const results = await runAvailability(
        wishlist.slice(0, 25).map((b) => ({ title: b.title, author: b.author }))
      );
      setWishlistResults(results);
    } catch {
      setWishlistResults(null);
    } finally {
      setWishlistLoading(false);
    }
  }

  async function handleWishlistStats() {
    if (wishlist.length === 0) return;
    setStatsLoading(true);
    setStatsResult(null);
    try {
      const books = wishlist.slice(0, 25).map((b) => ({ title: b.title, author: b.author }));
      const [availResults, priceResults] = await Promise.all([
        runAvailability(books),
        fetchPrices(books),
      ]);
      setWishlistResults(availResults);
      setPriceMap((prev) => {
        const next = { ...prev };
        priceResults.forEach((p) => {
          next[priceKey(p.title, p.author)] = { price: p.price, currency: p.currency };
        });
        return next;
      });
      setStatsResult(buildStats(availResults, {
        ...priceMap,
        ...Object.fromEntries(priceResults.map((p) => [priceKey(p.title, p.author), { price: p.price, currency: p.currency }])),
      }));
    } catch {
      setStatsResult(null);
    } finally {
      setStatsLoading(false);
    }
  }

  function handleCopyWishlist() {
    const text = wishlist.map((b) => (b.author ? `${b.title} by ${b.author}` : b.title)).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy as text"), 1500);
    });
  }

  function handleClearWishlist() {
    if (wishlist.length === 0) return;
    if (!window.confirm("Clear your entire wishlist? This can't be undone.")) return;
    setWishlist([]);
    setWishlistResults(null);
    setStatsResult(null);
  }

  function handleSendToCheck() {
    if (wishlist.length === 0) return;
    setListText((prev) => dedupeAppend(prev, wishlist.map(bookLine)));
    setActiveTab("check");
  }

  return (
    <div className="shell">
      <header className="header">
        <div>
          <h1 className="wordmark">
            Dewey<span className="accent">.</span>
          </h1>
          <p className="tagline">Find your next read on a Fulton County shelf</p>
        </div>
        <button
          className="theme-toggle"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          title="Toggle theme"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <div className="branch-picker">
        <label htmlFor="branch-select">Your branch</label>
        <div className="select-wrap">
          <Library size={16} className="select-icon" />
          <select
            id="branch-select"
            className="branch-select"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <nav className="tabs">
        <button
          className={`tab ${activeTab === "check" ? "active" : ""}`}
          onClick={() => setActiveTab("check")}
        >
          Check a List
        </button>
        <button
          className={`tab ${activeTab === "recs" ? "active" : ""}`}
          onClick={() => setActiveTab("recs")}
        >
          Get Recs
        </button>
        <button
          className={`tab ${activeTab === "wishlist" ? "active" : ""}`}
          onClick={() => setActiveTab("wishlist")}
        >
          Wishlist{wishlist.length > 0 ? ` (${wishlist.length})` : ""}
        </button>
      </nav>

      {activeTab === "check" && (
        <section className="panel">
          <textarea
            className="input-area"
            placeholder={
              'One book per line:\nLonesome Dove by Larry McMurtry\nAtomic Habits — James Clear\nThe Great Gatsby'
            }
            value={listText}
            onChange={(e) => setListText(e.target.value)}
          />

          <div className="format-selector">
            {FORMAT_OPTIONS.map((f) => (
              <button
                key={f.id}
                className={`format-option ${checkFormat === f.id ? "active" : ""}`}
                onClick={() => setCheckFormat(f.id)}
                disabled={checkLoading}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="card-actions">
            <button className="btn btn-primary" onClick={handleCheckList} disabled={checkLoading}>
              {checkLoading ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
              Check
            </button>
            <span className="hint">Up to 25 books per check</span>
          </div>

          <div className="starter-lists">
            <span className="starter-label">Or start from a list</span>
            {["age", "topic"].map((group) => (
              <div key={group} className="chip-row">
                {starterLists
                  .filter((l) => l.group === group)
                  .map((l) => (
                    <button
                      key={l.id}
                      className={`chip ${openStarterId === l.id ? "active" : ""}`}
                      onClick={() => setOpenStarterId((prev) => (prev === l.id ? null : l.id))}
                    >
                      {(() => {
                        const Icon = LIST_ICONS[l.id];
                        return Icon ? <Icon size={14} className="chip-icon" /> : <span aria-hidden="true">{l.emoji}</span>;
                      })()}
                      {l.label}
                    </button>
                  ))}
              </div>
            ))}
          </div>

          {openStarterId && (
            <StarterListPanel
              list={starterLists.find((l) => l.id === openStarterId)}
              listText={listText}
              onAdd={setListText}
              onClose={() => setOpenStarterId(null)}
            />
          )}

          {checkError && (
            <div className="error-banner">
              <AlertCircle size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
              {checkError}
            </div>
          )}

          {checkLoading && <SkeletonList count={Math.min(parseBookList(listText).length || 3, 6)} />}

          {!checkLoading && checkResults && checkResults.length > 0 && (
            <>
              <div className="export-row">
                <button className="btn btn-secondary" onClick={() => copyResults(checkResults, setCheckCopyLabel)}>
                  <Copy size={16} />
                  {checkCopyLabel}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => downloadCsv("dewey-check-results.csv", resultsToCsv(checkResults, priceMap))}
                >
                  <FileDown size={16} />
                  CSV
                </button>
              </div>
              <div className="results-list">
                {checkResults.map((r, i) => (
                  <ResultCard key={i} result={r} wishlist={wishlist} onToggleWishlist={toggleWishlist} />
                ))}
              </div>
            </>
          )}

          {!checkLoading && checkResults === null && !checkError && (
            <div className="empty-state">
              <Library size={32} />
              <p>Paste a list of titles above and we&apos;ll check what&apos;s on the shelf at your branch.</p>
            </div>
          )}
        </section>
      )}

      {activeTab === "recs" && (
        <section className="panel">
          <textarea
            className="input-area"
            placeholder="Tell us what you love… e.g. slow-burn literary fiction with unreliable narrators, or fast sci-fi with found families."
            value={recPrompt}
            onChange={(e) => setRecPrompt(e.target.value)}
            maxLength={500}
          />
          <div className="card-actions">
            <button className="btn btn-primary" onClick={handleGetRecs} disabled={recLoading}>
              {recLoading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
              Get Recs
            </button>
            <span className="hint">{recPrompt.length}/500</span>
          </div>

          {recError && (
            <div className="error-banner">
              <AlertCircle size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
              {recError}
            </div>
          )}

          {recLoading && <SkeletonList count={4} />}

          {!recLoading && recResults && (
            <div className="results-list">
              {recResults.map((rec, i) => {
                const avail = recAvailability[i];
                const inWishlist = wishlist.some((b) => sameBook(b, { title: rec.title, author: rec.author }));
                return (
                  <div key={i} className="card">
                    <div className="card-row">
                      <div className="card-lead">
                        {avail?.result?.coverUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avail.result.coverUrl} alt="" className="cover" loading="lazy" />
                        )}
                        <div>
                        <p className="card-title">{rec.title}</p>
                        <p className="card-author">
                          {rec.author}
                          {rec.year ? ` · ${rec.year}` : ""}
                        </p>
                        </div>
                      </div>
                      <button
                        className={`btn-icon ${inWishlist ? "active" : ""}`}
                        onClick={() => toggleWishlist({ title: rec.title, author: rec.author })}
                        title={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
                      >
                        {inWishlist ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                      </button>
                    </div>
                    <p className="one-liner">{rec.oneLiner}</p>
                    <div className="card-meta">
                      {avail?.loading && <Loader2 size={14} className="spin" />}
                      {avail?.result && <StatusPill result={avail.result} />}
                      {!avail?.loading && !avail?.result && (
                        <button
                          className="btn-ghost"
                          onClick={() => checkRecAvailability(i, rec)}
                        >
                          Check availability
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!recLoading && recResults === null && !recError && (
            <div className="empty-state">
              <Sparkles size={32} />
              <p>Describe what you&apos;re in the mood for and we&apos;ll suggest 8 books worth reading.</p>
            </div>
          )}
        </section>
      )}

      {activeTab === "wishlist" && (
        <section className="panel">
          {wishlist.length === 0 ? (
            <div className="empty-state">
              <BookMarked size={32} />
              <p>Nothing saved yet. Add books from Check a List or Get Recs and they&apos;ll show up here.</p>
            </div>
          ) : (
            <>
              <div className="wishlist-toolbar">
                <button className="btn btn-primary" onClick={handleCheckWishlist} disabled={wishlistLoading}>
                  {wishlistLoading ? <Loader2 size={16} className="spin" /> : <Library size={16} />}
                  Check all at my branch
                </button>
                <button className="btn btn-secondary" onClick={handleWishlistStats} disabled={statsLoading}>
                  {statsLoading ? <Loader2 size={16} className="spin" /> : <Calculator size={16} />}
                  Check all + price it
                </button>
                <button className="btn btn-secondary" onClick={handleCopyWishlist}>
                  <Copy size={16} />
                  {copyLabel}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    downloadCsv(
                      "dewey-wishlist.csv",
                      resultsToCsv(wishlistResults || wishlistAsResultRows(wishlist), priceMap)
                    )
                  }
                >
                  <FileDown size={16} />
                  CSV
                </button>
                <button className="btn btn-secondary" onClick={handleSendToCheck}>
                  <Send size={16} />
                  Send to Check tab
                </button>
                <button className="btn btn-secondary" onClick={handleClearWishlist}>
                  <Trash2 size={16} />
                  Clear all
                </button>
              </div>

              {statsResult && (
                <div className="stats-card">
                  <h3>Wishlist Ledger</h3>
                  {Object.values(statsResult.buckets).map((b) => (
                    <div className="stats-row" key={b.label}>
                      <span className="stats-label">{b.label}</span>
                      <span className="stats-value">
                        {b.count} {b.count === 1 ? "book" : "books"} · ${b.sum.toFixed(2)}
                        {b.unpriced > 0 ? ` (${b.unpriced} unpriced)` : ""}
                      </span>
                    </div>
                  ))}
                  <div className="stats-row total">
                    <span className="stats-label">TOTAL</span>
                    <span className="stats-value">{statsResult.total} books</span>
                  </div>
                  <div className="stats-summary">
                    <span className="buy-it-all">To buy it all: ${statsResult.buyItAll.toFixed(2)}</span>
                    <span className="saved">Free at the library today: ${statsResult.freeToday.toFixed(2)} saved</span>
                  </div>
                </div>
              )}

              {wishlistLoading && <SkeletonList count={Math.min(wishlist.length, 6)} />}

              {!wishlistLoading && wishlistResults && (
                <>
                  <div className="export-row">
                    <button
                      className="btn btn-secondary"
                      onClick={() => copyResults(wishlistResults, setWishlistResultsCopyLabel)}
                    >
                      <Copy size={16} />
                      {wishlistResultsCopyLabel}
                    </button>
                  </div>
                  <div className="results-list">
                    {wishlistResults.map((r, i) => (
                      <ResultCard key={i} result={r} wishlist={wishlist} onToggleWishlist={toggleWishlist} />
                    ))}
                  </div>
                </>
              )}

              {!wishlistResults && (
                <div className="results-list">
                  {wishlist.map((book, i) => (
                    <div key={i} className="wishlist-item">
                      <div>
                        <p className="card-title">{book.title}</p>
                        {book.author && <p className="card-author">{book.author}</p>}
                      </div>
                      <button
                        className="btn-icon danger"
                        onClick={() => removeFromWishlist(i)}
                        title="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
