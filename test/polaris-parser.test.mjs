import assert from "node:assert/strict";
import test from "node:test";
import { parseAvailability, parseSearchResults } from "../lib/polaris-parser.mjs";

test("selects a Polaris bib id from public result markup", () => {
  const html = '<div class="result"><a href="title.aspx?bibid=464469">The Very Hungry Caterpillar</a></div>';
  assert.equal(parseSearchResults(html, "The Very Hungry Caterpillar")[0].bibId, "464469");
});

test("parses checked-in branch availability and call number", () => {
  const html = '<tr><td>Dunwoody Library</td><td>J 590.3 Ver</td><td>Checked In</td></tr><tr><td>Decatur Library</td><td>Checked Out</td></tr>';
  assert.deepEqual(parseAvailability(html, "Dunwoody Library"), {
    status: "on_shelf", callNumber: "J 590.3 Ver", otherBranchCount: 0,
  });
});
