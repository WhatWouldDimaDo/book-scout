import libraries from "@/data/libraries.json";
import fultonBranches from "@/data/branches.json";
import dekalbBranches from "@/data/dekalbBranches.json";
import polarisBranches from "@/data/polarisBranches.json";
import branchLocations from "@/data/branchLocations.json";

export const DEFAULT_FORMATS = ["all", "print", "ebook", "audiobook"];

const bundledBranches = {
  fulton: fultonBranches,
  dekalb: dekalbBranches,
  ...polarisBranches,
};

export function getLibrarySystem(slug) {
  const config = libraries.find((library) => library.slug === slug);
  if (!config) return null;
  return {
    ...config,
    provider: config.provider || "bibliocommons",
    formats: config.formats || DEFAULT_FORMATS,
    branchSource: config.branchSource || "catalog",
  };
}

export function getBundledBranches(system) {
  if (!system) return null;
  return bundledBranches[system.branchSource] || null;
}

export function getBranchLocations(system) {
  if (!system) return [];
  return branchLocations.filter((location) => location.library === system.slug);
}

export function formatIsSupported(system, format) {
  return Boolean(system?.formats.includes(format));
}

export function branchIsValid(system, branch) {
  if (!system || typeof branch !== "string" || !branch.trim()) return false;
  const branches = getBundledBranches(system);
  if (!branches) return true;
  return branches.some((candidate) => candidate.code === branch);
}
