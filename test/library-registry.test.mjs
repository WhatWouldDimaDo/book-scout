import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getPolarisSettings } from "../lib/polaris.js";

const libraries = JSON.parse(await readFile(new URL("../data/libraries.json", import.meta.url), "utf8"));
const dekalbBranches = JSON.parse(await readFile(new URL("../data/dekalbBranches.json", import.meta.url), "utf8"));
const polarisBranches = JSON.parse(await readFile(new URL("../data/polarisBranches.json", import.meta.url), "utf8"));
const branchSets = { dekalb: dekalbBranches, ...polarisBranches };

test("library slugs are unique", () => {
  assert.equal(new Set(libraries.map((library) => library.slug)).size, libraries.length);
});

test("every Polaris system has valid catalog settings and a bundled default branch", () => {
  const systems = libraries.filter((library) => library.provider === "polaris");
  assert.equal(systems.length, 8);
  for (const system of systems) {
    const settings = getPolarisSettings(system);
    assert.match(settings.catalogBase, /^https:\/\//);
    assert.match(settings.catalogContext, /^\d+(?:\.\d+){4}$/);
    assert.deepEqual(system.formats, ["print"]);
    assert.ok(branchSets[system.branchSource]?.some((branch) => branch.code === system.defaultBranch));
  }
});

test("Polaris settings normalize trailing slashes and reject unsafe or malformed config", () => {
  assert.equal(settingsFor("https://example.test/polaris/").catalogBase, "https://example.test/polaris");
  assert.throws(() => settingsFor("http://example.test/polaris"), /plain HTTPS/);
  assert.throws(() => getPolarisSettings({ provider: "polaris", catalogBase: "https://example.test", catalogContext: "bad" }), /context/);
});

function settingsFor(catalogBase) {
  return getPolarisSettings({
    slug: "test",
    provider: "polaris",
    catalogBase,
    catalogContext: "1.1033.0.0.1",
  });
}
