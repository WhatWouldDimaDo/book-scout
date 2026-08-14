"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { initializeDeweyAnalytics, trackDeweyEvent } from "@/lib/analytics";
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
  Settings,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import fultonBranches from "@/data/branches.json";
import starterLists from "@/data/starterLists.json";
import libraries from "@/data/libraries.json";
import { parseBookList } from "@/lib/parseBookList";

const THEME_KEY = "dewey-theme";
const BRANCH_KEY = "dewey-branch";
const LIBRARY_KEY = "dewey-library";
const WISHLIST_KEY = "dewey-wishlist";
const FORMAT_KEY = "dewey-format";
const DEFAULT_LIBRARY = "fulcolibrary";
const DEFAULT_BRANCH = "PONCE";

function branchStorageKey(library) {
  return `dewey-branch-${library}`;
}

// "Fulton County (Atlanta), GA" -> "Atlanta"; "Seattle, WA" -> "Seattle".
function shortLibraryName(slug) {
  const lib = libraries.find((l) => l.slug === slug);
  if (!lib) return slug;
  const paren = lib.name.match(/\(([^)]+)\)/);
  if (paren) return paren[1];
  return lib.name.split(",")[0].trim();
}

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
  "adult-fiction": BookMarked,
  "mystery-thrillers": Search,
  "memoir-nonfiction": Bookmark,
};

const STATUS_CONFIG = {
  on_shelf: { label: "On Shelf", pillClass: "pill-on-shelf" },
  checked_out: { label: "Checked Out", pillClass: "pill-checked-out" },
  elsewhere: { label: "Elsewhere", pillClass: "pill-elsewhere" },
  not_found: { label: "Not Found", pillClass: "pill-not-found" },
};

const FORMAT_OPTIONS = [
  { id: "all", label: "All" },
  { id: "print", label: "Print" },
  { id: "ebook", label: "eBook" },
  { id: "audiobook", label: "Audiobook" },
];
const VALID_FORMATS = new Set(FORMAT_OPTIONS.map((option) => option.id));

const VISIBLE_CHIP_COUNT = 6;
const FEATURED_STARTER_LIST_IDS = [
  "ages-3-5",
  "adult-fiction",
  "ages-6-8",
  "mystery-thrillers",
  "ages-9-12",
  "memoir-nonfiction",
];
const FEATURED_STARTER_LISTS = FEATURED_STARTER_LIST_IDS
  .map((id) => starterLists.find((list) => list.id === id))
  .filter(Boolean);

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

function CatalogResultsHeader({ branchName }) {
  const dateLabel = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="catalog-header">
      CATALOG RESULTS &middot; {branchName} &middot; {dateLabel}
    </div>
  );
}

function ResultCard({ result, wishlist, onToggleWishlist }) {
  const title = result.matchedTitle || result.input;
  const author = result.author || "";
  const inWishlist = wishlist.some((b) => sameBook(b, { title, author }));
  const hasCallNumber = result.callNumber && !result.isDigital;
  return (
    <div className="card">
      <div className="card-row">
        <div className="card-lead">
          {result.coverUrl ? (
            <div className="cover-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.coverUrl} alt="" className="cover" loading="lazy" />
              {hasCallNumber && <span className="spine-label">{result.callNumber}</span>}
            </div>
          ) : (
            hasCallNumber && <span className="spine-label spine-label-standalone">{result.callNumber}</span>
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
  const [library, setLibrary] = useState(DEFAULT_LIBRARY);
  const [branch, setBranch] = useState(DEFAULT_BRANCH);
  const [branchOptions, setBranchOptions] = useState(
    fultonBranches.map((b) => ({ code: b.code, label: b.name }))
  );
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("check");
  const [wishlist, setWishlist] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [priceMap, setPriceMap] = useState({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);

  // Check a List
  const [listText, setListText] = useState("");
  const [checkFormat, setCheckFormat] = useState("all");
  const [checkResults, setCheckResults] = useState(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState(null);
  const [openStarterId, setOpenStarterId] = useState(null);
  const [checkCopyLabel, setCheckCopyLabel] = useState("Copy");
  const [chipsExpanded, setChipsExpanded] = useState(false);

  // Get Recs
  const [recPrompt, setRecPrompt] = useState("");
  const [recResults, setRecResults] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState(null);
  const [recAvailability, setRecAvailability] = useState({});
  const [recAllLoading, setRecAllLoading] = useState(false);

  // Wishlist checks
  const [wishlistResults, setWishlistResults] = useState(null);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy as text");
  const [wishlistResultsCopyLabel, setWishlistResultsCopyLabel] = useState("Copy");
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsResult, setStatsResult] = useState(null);

  useEffect(() => {
    initializeDeweyAnalytics();
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- client-only preferences are restored after hydration */
  useEffect(() => {
    const storedTheme = loadJSON(THEME_KEY, null);
    if (storedTheme) {
      setTheme(storedTheme);
    } else if (typeof window !== "undefined") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    }
    const storedLibrary = loadJSON(LIBRARY_KEY, DEFAULT_LIBRARY);
    setLibrary(libraries.some((l) => l.slug === storedLibrary) ? storedLibrary : DEFAULT_LIBRARY);
    const storedFormat = loadJSON(FORMAT_KEY, "all");
    setCheckFormat(VALID_FORMATS.has(storedFormat) ? storedFormat : "all");
    setWishlist(loadJSON(WISHLIST_KEY, []));
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute("data-theme", theme);
    saveJSON(THEME_KEY, theme);
  }, [theme, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(LIBRARY_KEY, library);
  }, [library, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(FORMAT_KEY, checkFormat);
  }, [checkFormat, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(branchStorageKey(library), branch);
  }, [branch, library, hydrated]);

  // Load the branch list whenever the library system changes (including the
  // initial hydration): Fulton uses the static bundled list, everything else
  // fetches the dynamic facet list from /api/branches.
  useEffect(() => {
    if (!hydrated) return;

    if (library === DEFAULT_LIBRARY) {
      const opts = fultonBranches.map((b) => ({ code: b.code, label: b.name }));
      // Branch options intentionally synchronize with the selected library.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBranchOptions(opts);
      const stored = loadJSON(branchStorageKey(library), loadJSON(BRANCH_KEY, DEFAULT_BRANCH));
      setBranch(opts.some((o) => o.code === stored) ? stored : opts[0]?.code || DEFAULT_BRANCH);
      return;
    }

    let cancelled = false;
    setBranchesLoading(true);
    setBranchOptions([]);
    fetch(`/api/branches?library=${encodeURIComponent(library)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const opts = data.branches || [];
        setBranchOptions(opts);
        const stored = loadJSON(branchStorageKey(library), null);
        const next = opts.some((o) => o.code === stored) ? stored : opts[0]?.code;
        if (next) setBranch(next);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBranchesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [library, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(WISHLIST_KEY, wishlist);
  }, [wishlist, hydrated]);

  useEffect(() => {
    if (!settingsOpen) return;
    function handleOutsideClick(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [settingsOpen]);

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

  async function runAvailability(books, format = "all", searchMode = "list") {
    const eventProperties = {
      search_mode: searchMode,
      selected_branch: branch,
      library_system: library,
      format,
      book_count: books.length,
    };

    trackDeweyEvent("dewey_search_started", eventProperties);

    try {
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ books, branch, format, library }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Availability check failed");

      trackDeweyEvent("dewey_search_completed", {
        ...eventProperties,
        success: true,
        result_count: data.results.length,
      });
      return data.results;
    } catch (error) {
      trackDeweyEvent("dewey_search_completed", {
        ...eventProperties,
        success: false,
        result_count: 0,
      });
      throw error;
    }
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
      const results = await runAvailability(books.slice(0, 25), checkFormat, "list");
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
    trackDeweyEvent("dewey_recommendation_started");
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: recPrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't get recommendations");
      setRecResults(data.results);
      trackDeweyEvent("dewey_recommendation_completed", {
        success: true,
        recommendation_count: data.results.length,
      });
    } catch (err) {
      setRecError(err.message);
      trackDeweyEvent("dewey_recommendation_completed", {
        success: false,
        recommendation_count: 0,
      });
    } finally {
      setRecLoading(false);
    }
  }

  async function checkRecAvailability(index, rec) {
    setRecAvailability((prev) => ({ ...prev, [index]: { loading: true } }));
    try {
      const results = await runAvailability(
        [{ title: rec.title, author: rec.author }],
        checkFormat,
        "recommendation_single"
      );
      setRecAvailability((prev) => ({ ...prev, [index]: { loading: false, result: results[0] } }));
    } catch {
      setRecAvailability((prev) => ({ ...prev, [index]: { loading: false, error: true } }));
    }
  }

  async function checkAllRecAvailability() {
    if (!recResults || recResults.length === 0) return;
    setRecAllLoading(true);
    setRecAvailability(Object.fromEntries(recResults.map((_, i) => [i, { loading: true }])));
    try {
      const books = recResults.map((rec) => ({ title: rec.title, author: rec.author }));
      const results = await runAvailability(books, checkFormat, "recommendations");
      setRecAvailability(Object.fromEntries(results.map((result, i) => [i, { loading: false, result }])));
    } catch {
      setRecAvailability(Object.fromEntries(recResults.map((_, i) => [i, { loading: false, error: true }])));
    } finally {
      setRecAllLoading(false);
    }
  }

  async function handleCheckWishlist() {
    if (wishlist.length === 0) return;
    setWishlistLoading(true);
    setWishlistResults(null);
    try {
      const results = await runAvailability(
        wishlist.slice(0, 25).map((b) => ({ title: b.title, author: b.author })),
        checkFormat,
        "wishlist"
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
        runAvailability(books, checkFormat, "wishlist_pricing"),
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
          <button
            className="settings-summary"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            aria-controls="dewey-settings"
            aria-label={`Change library or branch. Current selection: ${shortLibraryName(library)}, ${branchOptions.find((b) => b.code === branch)?.label || branch}.`}
          >
            <span>
              {shortLibraryName(library)} &middot; {branchOptions.find((b) => b.code === branch)?.label || branch}
            </span>
            <span className="settings-summary-action">
              Change branch
              <ChevronDown size={14} aria-hidden="true" />
            </span>
          </button>
        </div>
        <div className="header-actions" ref={settingsRef}>
          <button
            className="theme-toggle"
            onClick={() => setSettingsOpen((v) => !v)}
            title="Settings"
          >
            <Settings size={18} />
          </button>
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {settingsOpen && (
            <div className="settings-popover" id="dewey-settings">
              <div className="settings-popover-header">
                <span>Settings</span>
                <button className="btn-icon" onClick={() => setSettingsOpen(false)} title="Close">
                  <X size={14} />
                </button>
              </div>
              <div className="settings-field">
                <label htmlFor="library-select">Library system</label>
                <div className="select-wrap">
                  <Library size={16} className="select-icon" />
                  <select
                    id="library-select"
                    className="branch-select"
                    value={library}
                    onChange={(e) => setLibrary(e.target.value)}
                  >
                    {libraries.map((l) => (
                      <option key={l.slug} value={l.slug}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="hint settings-hint">
                  {library === "dekalb-polaris"
                    ? "Preview: public DeKalb Polaris catalog lookup for print titles."
                    : `${libraries.length - 1} systems on BiblioCommons — availability data is live from each catalog.`}
                </p>
              </div>
              <div className="settings-field">
                <label htmlFor="branch-select">Your branch</label>
                <div className="select-wrap">
                  <Library size={16} className="select-icon" />
                  <select
                    id="branch-select"
                    className="branch-select"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    disabled={branchesLoading || branchOptions.length === 0}
                  >
                    {branchOptions.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
                {branchesLoading && <p className="hint settings-hint">Loading branches…</p>}
              </div>
              <div className="settings-field">
                <label htmlFor="format-select">Format</label>
                <div className="select-wrap">
                  <BookMarked size={16} className="select-icon" />
                  <select
                    id="format-select"
                    className="branch-select"
                    value={checkFormat}
                    onChange={(e) => setCheckFormat(e.target.value)}
                  >
                    {FORMAT_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="hint settings-hint">
                  Applies to list, recommendation, and wishlist availability checks.
                </p>
              </div>
            </div>
          )}
        </div>
      </header>

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
              'Try entering some books (one per line):\nPat the Bunny by Dorothy Kunhardt\nThe Very Hungry Caterpillar by Eric Carle\nFrog and Toad Are Friends by Arnold Lobel'
            }
            value={listText}
            onChange={(e) => setListText(e.target.value)}
          />

          <div className="card-actions">
            <button className="btn btn-primary" onClick={handleCheckList} disabled={checkLoading}>
              {checkLoading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
              Search
            </button>
            <span className="hint">Up to 25 books per check</span>
          </div>

          <div className="starter-lists">
            <span className="starter-label">Or start from a list</span>
            <div className="chip-row">
              {(chipsExpanded ? starterLists : FEATURED_STARTER_LISTS).map((l) => (
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
              {starterLists.length > VISIBLE_CHIP_COUNT && (
                <button
                  className={`chip chip-more ${chipsExpanded ? "active" : ""}`}
                  onClick={() => setChipsExpanded((v) => !v)}
                >
                  {chipsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {chipsExpanded ? "Fewer lists" : `More lists (${starterLists.length - VISIBLE_CHIP_COUNT})`}
                </button>
              )}
            </div>
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
              <CatalogResultsHeader branchName={branchOptions.find((b) => b.code === branch)?.label || branch} />
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
            placeholder={'Try asking for recommendations:\nFunny bedtime books for a 4-year-old\nEarly chapter books about friendship for a 7-year-old'}
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
          <p className="recommendation-privacy">
            Please don&apos;t include names or other personal information.
          </p>

          {recError && (
            <div className="error-banner">
              <AlertCircle size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
              {recError}
            </div>
          )}

          {recLoading && <SkeletonList count={4} />}

          {!recLoading && recResults && recResults.length > 0 && (
            <div className="card-actions">
              <button className="btn btn-secondary" onClick={checkAllRecAvailability} disabled={recAllLoading}>
                {recAllLoading ? <Loader2 size={16} className="spin" /> : <Library size={16} />}
                Check all at my branch
              </button>
            </div>
          )}

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
                  <h3>Library Record</h3>
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
                    <span className="stamp-badge">
                      Free at the library today &mdash; ${statsResult.freeToday.toFixed(2)} saved
                    </span>
                  </div>
                </div>
              )}

              {wishlistLoading && <SkeletonList count={Math.min(wishlist.length, 6)} />}

              {!wishlistLoading && wishlistResults && (
                <>
                  <CatalogResultsHeader branchName={branchOptions.find((b) => b.code === branch)?.label || branch} />
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

      <footer className="site-credit">
        <span>See more of my work at</span>
        <a className="site-credit-brand" href="https://dimadimadima.com/">
          <span className="site-credit-mark" aria-hidden="true" />
          dimadimadima.com
        </a>
        <span className="site-credit-divider" aria-hidden="true">|</span>
        <span>
          Learn more about this{" "}
          <a
            href="https://dimadimadima.com/projects/dewey"
            onClick={() => trackDeweyEvent("dewey_story_clicked")}
          >
            project
          </a>
        </span>
      </footer>
    </div>
  );
}
