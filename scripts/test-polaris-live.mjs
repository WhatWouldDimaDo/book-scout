import { checkPolarisBookAvailability } from "../lib/polaris.js";
import { readFile } from "node:fs/promises";

const libraries = JSON.parse(await readFile(new URL("../data/libraries.json", import.meta.url), "utf8"));
const polarisSystems = libraries.filter((library) => library.provider === "polaris");
const dekalb = polarisSystems.find((library) => library.slug === "dekalb");

const samples = [
  { title: "The Very Hungry Caterpillar", author: "Eric Carle" },
  { title: "Where the Wild Things Are", author: "Maurice Sendak" },
  { title: "Atomic Habits", author: "James Clear" },
  { title: "Tomorrow, and Tomorrow, and Tomorrow", author: "Gabrielle Zevin" },
  { title: "James", author: "Percival Everett" },
  { title: "Curious George", expectedTitle: "Curious George" },
  { title: "This Title Intentionally Does Not Exist 8675309" },
];

for (const book of samples) {
  const result = await checkPolarisBookAvailability(book, dekalb.defaultBranch, [], dekalb);
  if (book.expectedTitle && result.matchedTitle?.toLowerCase() !== book.expectedTitle.toLowerCase()) {
    throw new Error(`Expected ${book.expectedTitle}, received ${result.matchedTitle || result.status}`);
  }
  console.log(JSON.stringify({
    input: book.title,
    matchedTitle: result.matchedTitle,
    author: result.author,
    status: result.status,
    callNumber: result.callNumber,
    otherBranchCount: result.otherBranchCount,
    confidence: result.confidence,
    errorCode: result.errorCode,
  }));
}

for (const system of polarisSystems.filter((library) => library.slug !== "dekalb")) {
  const result = await checkPolarisBookAvailability(
    { title: "Curious George" },
    system.defaultBranch,
    [],
    system,
  );
  if (result.status === "unavailable" || !result.matchedTitle?.toLowerCase().includes("curious george")) {
    throw new Error(`${system.slug} live check failed: ${result.matchedTitle || result.errorCode || result.status}`);
  }
  console.log(JSON.stringify({
    system: system.slug,
    branch: system.defaultBranch,
    matchedTitle: result.matchedTitle,
    status: result.status,
    callNumber: result.callNumber,
    otherBranchCount: result.otherBranchCount,
  }));
}
