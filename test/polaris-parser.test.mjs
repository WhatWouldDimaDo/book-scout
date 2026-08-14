import assert from "node:assert/strict";
import test from "node:test";
import { parseAvailability, parseSearchResults } from "../lib/polaris-parser.mjs";

function result({ pos, bibId, title, author = "", format = "Book", cover = "" }) {
  return `<div class="search__position"><a id="__pos-${pos}"></a></div>
    <div class="content-module content-module--search-result">
      <img class='c-title-detail__thumbnail hover__thumbnail' src="${cover}" alt="">
      <img class="c-title-detail-formats__img" alt="${format}">
      <a class="nsm-brief-action-link" href="title.aspx?ctx=x&amp;pos=${pos}&amp;cn=${bibId}"><span>${title}</span></a>
      ${author ? `<div class="nsm-brief-primary-author-group">by <span>${author}</span></div>` : ""}
    </div>`;
}

function location({ name, available, total, pieces = [] }) {
  return `<tr class="location"><td><a class="group"><i></i>${name}</a>
    <div>(${available} of ${total} available)</div></td></tr>
    ${pieces.map(({ call, status }) => `<tr class="piece"><td><a href="AjaxSMSFrm.aspx?callnum=${call.replaceAll(" ", "+")}&amp;bran=x">Text</a>${call}</td><td class="piece">${status}</td><td class="piece">Book</td></tr>`).join("")}`;
}

test("selects an exact title later in structured Polaris results", () => {
  const html = [
    result({ pos: 1, bibId: "464469", title: "The very hungry caterpillar's very first animal encyclopedia" }),
    result({ pos: 5, bibId: "32375", title: "The very hungry caterpillar", author: "Carle, Eric", cover: "https://example.test/cover.gif" }),
  ].join("");
  const best = parseSearchResults(html, "The Very Hungry Caterpillar", "Eric Carle")[0];
  assert.equal(best.bibId, "32375");
  assert.equal(best.pos, 5);
  assert.equal(best.title, "The very hungry caterpillar");
  assert.equal(best.author, "Carle, Eric");
  assert.equal(best.coverUrl, "https://example.test/cover.gif");
  assert.ok(best.score >= 0.88);
});

test("uses the author to disambiguate identical titles", () => {
  const html = [
    result({ pos: 1, bibId: "111", title: "James", author: "Smith, Robert" }),
    result({ pos: 2, bibId: "222", title: "James", author: "Everett, Percival" }),
  ].join("");
  assert.equal(parseSearchResults(html, "James", "Percival Everett")[0].bibId, "222");
});

test("does not inflate an unrelated title from surrounding result text", () => {
  const html = result({ pos: 1, bibId: "370853", title: "It Chapter Two", author: "King, Stephen" });
  const [candidate] = parseSearchResults(html, "It", "Stephen King");
  assert.ok(candidate.score < 0.72);
});

test("parses selected branch checked-out status, call number, due date, and unique other locations", () => {
  const html = [
    location({ name: "Clarkston Library", available: 1, total: 1, pieces: [{ call: "J P CARLE", status: "Checked In" }] }),
    location({ name: "Dunwoody Library", available: 0, total: 2, pieces: [{ call: "J P CARLE", status: "Checked Out (Due: 8/21/2026)" }] }),
    location({ name: "Embry Hills Library", available: 1, total: 1, pieces: [{ call: "J P CARLE", status: "Checked In" }] }),
  ].join("");
  assert.deepEqual(parseAvailability(html, "Dunwoody Library"), {
    status: "checked_out",
    callNumber: "J P CARLE",
    dueDate: "8/21/2026",
    otherBranchCount: 2,
    branchFound: true,
  });
});

test("returns elsewhere rather than borrowing another branch's status when selected branch is absent", () => {
  const html = location({ name: "Clarkston Library", available: 1, total: 1, pieces: [{ call: "J P CARLE", status: "Checked In" }] });
  assert.deepEqual(parseAvailability(html, "Dunwoody Library"), {
    status: "elsewhere",
    callNumber: null,
    dueDate: null,
    otherBranchCount: 1,
    branchFound: false,
  });
});

test("rejects an expired anonymous catalog session as a provider failure", () => {
  assert.throws(() => parseAvailability("POWERPAC-ERROR:TIMEOUT", "Dunwoody Library"), /session expired/i);
});
