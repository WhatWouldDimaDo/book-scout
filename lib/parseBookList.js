// Parses freeform "one book per line" text into {title, author} objects.
// Supported line formats: "Title by Author", "Title — Author", "Title - Author", or just "Title".
export function parseBookList(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const byMatch = line.match(/^(.+?)\s+by\s+(.+)$/i);
      if (byMatch) {
        return { title: byMatch[1].trim(), author: byMatch[2].trim() };
      }
      const dashMatch = line.match(/^(.+?)\s*[—–]\s*(.+)$/);
      if (dashMatch) {
        return { title: dashMatch[1].trim(), author: dashMatch[2].trim() };
      }
      return { title: line, author: "" };
    });
}
