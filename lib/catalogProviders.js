import { checkBookAvailability } from "@/lib/bibliocommons";
import { checkPolarisBookAvailability } from "@/lib/polaris";
import { getBranchLocations } from "@/lib/librarySystems";

const providers = {
  bibliocommons: ({ book, branch, format, system }) =>
    checkBookAvailability(book, branch, format, system.slug),
  polaris: ({ book, branch, system }) =>
    checkPolarisBookAvailability(book, branch, getBranchLocations(system)),
};

export function checkCatalogBookAvailability(context) {
  const provider = providers[context.system.provider];
  if (!provider) throw new Error(`Unsupported catalog provider: ${context.system.provider}`);
  return provider(context);
}
