import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  nearestBranchLocations,
  searchBranchLocations,
} from "../lib/branchLocator.mjs";

const locations = JSON.parse(
  await readFile(new URL("../data/branchLocations.json", import.meta.url), "utf8"),
);

test("bundles every Fulton and DeKalb branch with valid coordinates", () => {
  assert.equal(locations.filter((location) => location.library === "fulcolibrary").length, 34);
  assert.equal(locations.filter((location) => location.library === "dekalb").length, 23);
  assert.equal(new Set(locations.map((location) => `${location.library}:${location.code}`)).size, 57);
  assert.ok(locations.every((location) => Number.isFinite(location.latitude)));
  assert.ok(locations.every((location) => Number.isFinite(location.longitude)));
});

test("searches by ZIP, branch name, city, address, and system", () => {
  assert.ok(searchBranchLocations(locations, "30306").some((location) => location.code === "PONCE"));
  assert.equal(searchBranchLocations(locations, "Dunwoody")[0].code, "Dunwoody Library");
  assert.ok(searchBranchLocations(locations, "Ponce Avenue").some((location) => location.code === "PONCE"));
  assert.ok(searchBranchLocations(locations, "DeKalb Decatur").every((location) => location.library === "dekalb"));
});

test("ranks exact current coordinates as the nearest branch", () => {
  const ponce = locations.find((location) => location.code === "PONCE");
  const [nearest] = nearestBranchLocations(locations, ponce, 1);
  assert.equal(nearest.location.code, "PONCE");
  assert.equal(nearest.distance, 0);
});
