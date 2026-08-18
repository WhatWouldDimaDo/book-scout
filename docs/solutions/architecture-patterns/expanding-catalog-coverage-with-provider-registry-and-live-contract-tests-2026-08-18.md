---
title: Expand catalog coverage through a provider registry and live contract tests
date: 2026-08-18
category: architecture-patterns
module: Library catalog providers
problem_type: architecture_pattern
component: service_object
severity: high
applies_when:
  - Adding library systems that share a catalog platform
  - Moving an existing system from one catalog vendor to another
  - Reporting the geographic reach of configured catalog integrations
tags: [library-catalog, provider-registry, polaris, bibliocommons, contract-testing, coverage]
---

# Expand catalog coverage through a provider registry and live contract tests

## Context

A vendor name alone does not prove that another library can use an existing
adapter. Installations differ by hostname, path, catalog context, branch
labels, formats, session behavior, and vendor migrations. Dewey needed to grow
from Fulton and DeKalb without spreading library-specific conditions through
the UI and API or presenting untested catalog endpoints as supported.

## Guidance

Keep library-specific facts in one static registry and dispatch through a
small normalized provider contract:

```json
{
  "slug": "fairfax",
  "provider": "polaris",
  "branchSource": "fairfax",
  "defaultBranch": "Chantilly Regional Library",
  "formats": ["print"],
  "catalogBase": "https://fcplcat.fairfaxcounty.gov",
  "catalogContext": "1.1033.0.0.1"
}
```

The client and server must consume the same registry. Switching systems clears
stale results, loads and validates that system's branches, constrains formats,
and ignores responses started under an older selection. Provider adapters
return the same result shape regardless of vendor.

Before enabling an entry, replay a positive-control request through the actual
public flow. For Polaris this means one anonymous session across search,
structured results, and holdings. For BiblioCommons, verify that the gateway
slug returns a non-empty branch/status facet and that a precise title query is
accepted. Keep deterministic fixtures for parser semantics and a read-only live
matrix for installation drift:

```bash
npm test
npm run test:polaris:live
npm run build
```

Production verification should exercise both the canonical app and any
reverse proxy. A preview built with different asset-prefix behavior is not a
substitute for the production artifact.

Measure reach separately from technical configuration. Catalog networks,
public-library administrative entities, physical outlets, legal-service-area
population, registered-card records, and actual product users are different
denominators. Prefer IMLS unduplicated service-area population for U.S. reach
and state clearly that it is addressable coverage, not adoption.

## Why This Matters

The registry makes a platform expansion mostly data-driven while preserving
server-side validation and a single UI. Live contract tests catch catalog
migrations and installation-specific behavior that unit fixtures cannot. The
separate coverage method prevents a technically accurate integration count
from turning into an inflated audience or patron claim.

## When to Apply

- Adding another installation of an existing catalog family.
- Introducing a third provider adapter.
- Refreshing a system after its public catalog changes vendors or URLs.
- Publishing network, branch, or service-population coverage figures.

## Examples

The 2026-08-18 release configured 40 networks: 32 BiblioCommons and eight
Polaris. Release verification found non-empty branch discovery for all 32
BiblioCommons entries and completed a title/holdings positive control for all
eight Polaris entries. Fairfax/Chantilly was then checked through both
`deweybooks.vercel.app` and the same-origin `/dewey` proxy before the release
was documented as live.

## Related

- `docs/solutions/integration-issues/polaris-public-catalog-session-and-structured-parsing.md`
- `docs/solutions/integration-issues/bibliocommons-precise-queries-and-covers-2026-07-10.md`
- `docs/research/catalog-coverage-estimate-2026-08-18.md`
- `data/libraries.json`
