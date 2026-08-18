# Dewey catalog coverage estimate

Updated 2026-08-18. This is a planning estimate, not a user or adoption metric.

Production verification on 2026-08-18 confirmed non-empty branch discovery
for all 32 configured BiblioCommons networks and a read-only title/holdings
positive control for all eight configured Polaris networks. These checks show
that the configured integrations responded at release time; they do not make
the unofficial catalog interfaces contractual or permanently stable.

## Current scope

- 40 configured catalog networks: 36 in the United States and four in Canada.
- 32 use BiblioCommons; eight use Polaris in beta. San Diego migrated from BiblioCommons to Polaris in August 2026.
- The U.S. networks map provisionally to 53 IMLS public-library administrative entities because WCCLS and MARINet are consortia.
- Approximately 772 U.S. central/branch outlets plus 89 Canadian locations, or roughly 860 physical public-library locations in total. Outlet totals vary slightly with temporary closures and consortium membership.

## U.S. reach estimates

Using a provisional join to the FY2024 IMLS Public Libraries Survey:

- 28,964,320 people in unduplicated legal service areas represented.
- 8.74% of the IMLS national unduplicated service-area population (331,344,874).
- 8.52% of the Census Bureau's 2024 U.S. population estimate (340,110,988).
- 13,978,983 registered-user records, or 9.02% of the national IMLS total. These are card records, not unique people or active Dewey users.
- About 4.7% of U.S. public-library central/branch outlets.

## Interpretation rules

- Say “configured networks,” not “library systems,” when describing the 40 catalog endpoints.
- Treat service-area population as addressable reach, not patrons, registered cardholders, site visitors, or Dewey users.
- Do not add raw city/county populations: service boundaries overlap and often exclude municipal systems.
- Use IMLS `POPU_UND` for the main U.S. share. `POPU_LSA` can double-count overlapping legal service areas.
- Expand consortia to member public-library entities. Exclude academic and school holdings sites.
- Re-run live catalog checks and refresh the mapping before using the estimate externally.

## Sources

- [IMLS Public Libraries Survey](https://www.imls.gov/research-evaluation/surveys/public-libraries-survey-pls)
- [FY2024 IMLS CSV](https://www.imls.gov/sites/default/files/2026-06/pls_fy2024_csv.zip)
- [FY2024 IMLS documentation and user guide](https://www.imls.gov/sites/default/files/2026-06/PublicLibrariesSurvey_FiscalYear2024_DataDocumentationandUsersGuide.pdf)
- [U.S. Census QuickFacts](https://www.census.gov/quickfacts/fact/table/US/PST045225)
- [WCCLS member libraries](https://www.wccls.org/libraries)
- [MARINet membership](https://marinlibrary.org/collection-development-policy/)
- [San Diego catalog migration notice](https://www.sandiego.gov/public-library/elibrary)
