import { checkPolarisBookAvailability } from "../lib/polaris.js";

const samples = [
  { title: "The Very Hungry Caterpillar", author: "Eric Carle" },
  { title: "Where the Wild Things Are", author: "Maurice Sendak" },
  { title: "Atomic Habits", author: "James Clear" },
  { title: "Tomorrow, and Tomorrow, and Tomorrow", author: "Gabrielle Zevin" },
  { title: "James", author: "Percival Everett" },
  { title: "This Title Intentionally Does Not Exist 8675309" },
];

for (const book of samples) {
  const result = await checkPolarisBookAvailability(book, "Dunwoody Library");
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
