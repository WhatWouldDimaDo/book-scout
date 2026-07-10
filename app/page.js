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
  dinosaurs: Bone,
  space: Rocket,
  "trucks-things-that-go": Truck,
  "funny-books": Laugh,
  "big-feelings": Heart,
  animals: PawPrint,
  "graphic-novels": Zap,
  "award-winners": Trophy,
};

const STATUS_CONFIG = {
  on_shelf: { label: "On Shelf", pillClass: "pill-on-shelf" },
  checked_out: { label: "Checked Out", pillClass: "pill-checked-out" },
  elsewhere: { label: "Elsewhere", pillClass: "pill-elsewhere" },
  not_found: { label: "Not Found", pillClass: "pill-not-found" },
};

function formatDueDate(dueDate) {
  if (!dueDate) return null;
  try {
    return new Date(dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return dueDate;
  }
}

function StatusPill({ result }) {
  if (!result) return null;
  const config = STATUS_CONFIG[result.status] || STATUS_CONFIG.not_found;
  let label = config.label;
  if (result.status === "checked_out" && result.dueDate) {
    label = `Checked Out — back ${formatDueDate(result.dueDate)}`;
  } else if (result.status === "elsewhere") {
    label =
      result.otherBranchCount > 0
        ? `At ${result.otherBranchCount} other branch${result.otherBranchCount === 1 ? "" : "es"}`
        : "Not at this branch";
  }
  return <span className={`pill ${config.pillClass}`}>{label}</span>;
}

function ResultCard({ result, onAddToWishlist }) {
  const title = result.matchedTitle || result.input;
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
            {result.author && <p className="card-author">{result.author}</p>}
          </div>
        </div>
        <button
          className="btn-icon"
          onClick={() => onAddToWishlist({ title, author: result.author || "" })}
          title="Add to wishlist"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="card-meta">
        <StatusPill result={result} />
        {result.confidence === "verify" && <span className="badge-verify">Verify match</span>}
        {result.callNumber && <span>{result.callNumber}</span>}
      </div>
      {result.recordUrl && (
        <a href={result.recordUrl} target="_blank" rel="noreferrer" className="record-link">
          View record <ExternalLink size={12} />
        </a>
      )}
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

export default function Home() {
  const [theme, setTheme] = useState("light");
  const [branch, setBranch] = useState(DEFAULT_BRANCH);
  const [activeTab, setActiveTab] = useState("check");
  const [wishlist, setWishlist] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  // Check a List
  const [listText, setListText] = useState("");
  const [checkResults, setCheckResults] = useState(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState(null);

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

  const addToWishlist = useCallback((book) => {
    setWishlist((prev) => {
      const exists = prev.some(
        (b) => b.title.toLowerCase() === book.title.toLowerCase() && b.author === book.author
      );
      if (exists) return prev;
      return [...prev, { ...book, addedAt: new Date().toISOString() }];
    });
  }, []);

  const removeFromWishlist = useCallback((index) => {
    setWishlist((prev) => prev.filter((_, i) => i !== index));
  }, []);

  async function runAvailability(books) {
    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ books, branch }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Availability check failed");
    return data.results;
  }

  async function runCheck(books) {
    if (books.length === 0) return;
    setCheckLoading(true);
    setCheckError(null);
    setCheckResults(null);
    try {
      const results = await runAvailability(books.slice(0, 25));
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

  function applyStarterList(list) {
    const books = list.books.slice(0, 25);
    setListText(books.map((b) => `${b.title} by ${b.author}`).join("\n"));
    runCheck(books);
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

  function handleCopyWishlist() {
    const text = wishlist.map((b) => (b.author ? `${b.title} by ${b.author}` : b.title)).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy as text"), 1500);
    });
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
                      className="chip"
                      onClick={() => applyStarterList(l)}
                      disabled={checkLoading}
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

          {checkError && (
            <div className="error-banner">
              <AlertCircle size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
              {checkError}
            </div>
          )}

          {checkLoading && <SkeletonList count={Math.min(parseBookList(listText).length || 3, 6)} />}

          {!checkLoading && checkResults && (
            <div className="results-list">
              {checkResults.map((r, i) => (
                <ResultCard key={i} result={r} onAddToWishlist={addToWishlist} />
              ))}
            </div>
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
                        className="btn-icon"
                        onClick={() => addToWishlist({ title: rec.title, author: rec.author })}
                        title="Add to wishlist"
                      >
                        <Plus size={16} />
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
                <button className="btn btn-secondary" onClick={handleCopyWishlist}>
                  <Copy size={16} />
                  {copyLabel}
                </button>
              </div>

              {wishlistLoading && <SkeletonList count={Math.min(wishlist.length, 6)} />}

              {!wishlistLoading && wishlistResults && (
                <div className="results-list">
                  {wishlistResults.map((r, i) => (
                    <ResultCard key={i} result={r} onAddToWishlist={addToWishlist} />
                  ))}
                </div>
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
