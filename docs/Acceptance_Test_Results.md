# Phase 6 Acceptance Test Results

## Test environment and safety

- Main dashboard: http://127.0.0.1:3000, connected to the configured depgraph database. Existing main-database records were read through the app and browser; no seed/reset/drop or destructive acceptance operation was run against depgraph.
- API integration fixtures: disposable MongoDB database depgraph_phase6_acceptance_20261022_a91c on the local MongoDB server, served by a temporary app on port 3001. This database was created for this test run and dropped after testing.
- Disconnected-database test: temporary app on port 3002 pointed at unavailable MongoDB port 27019 with database name depgraph_phase6_offline_test. It could not connect and wrote no records.
- The normal application startup runs its existing legacy-field migration and index-creation setup. This is part of the app's startup behavior and is distinct from adding or deleting application test records.

## Automated tests

| Test ID | Feature | Input/action | Expected result | Actual result | Status |
| --- | --- | --- | --- | --- | --- |
| AUTO-01 | Semantic-version ordering | Compare releases and prerelease identifiers | Correct SemVer ordering | Test passed | PASS |
| AUTO-02 | Version ranges | Check supported ranges and unsupported syntax | Supported ranges resolve; unsupported syntax stays unknown | Test passed | PASS |
| AUTO-03 | Version intelligence | Omit or supply unparseable installed/comparison versions | Insufficient data is not labeled behind | Test passed | PASS |
| AUTO-04 | Vulnerability identity | Compare package names across ecosystems | Exact ecosystem and package identity required | Test passed | PASS |
| AUTO-05 | Project analytics | Combine review labels, comparison gaps, and affected notes | Link risk is deduplicated and score is correct | Test passed | PASS |

Command: npm test from server/. Result: 5 tests passed, 0 failed, 0 skipped.

## Source and document checks

| Test ID | Feature | Input/action | Expected result | Actual result | Status |
| --- | --- | --- | --- | --- | --- |
| CHECK-01 | Backend syntax | Run node --check on every backend JavaScript file | No syntax errors | 13 files checked; all passed | PASS |
| CHECK-02 | Frontend syntax | Extract the inline script and check in classic-script mode | No syntax errors | Passed | PASS |
| CHECK-03 | Whitespace check | Run git diff --check and scan all seven README/documentation deliverables after writing them | No whitespace errors | No output/errors; no trailing whitespace found | PASS |


## Database, API, and persistence checks

| Test ID | Feature | Input/action | Expected result | Actual result | Status |
| --- | --- | --- | --- | --- | --- |
| DB-01 | Main connection | Read /api/health on port 3000 | Connected to depgraph | Connected; dashboard showed MongoDB connected | PASS |
| DB-02 | Main persistence | Refresh dashboard opened through port 3000 | Previously stored records still load from the API | Refreshed UI showed the persisted project list and current inventory | PASS |
| DB-03 | Offline handling | Serve dashboard with MongoDB port 27019 unavailable | Health is 503; page serves and displays disconnected state | API 503/disconnected; dashboard page 200 with zero counts and an API unavailable banner | PASS |
| API-01 | Project create/read | POST project, then list it in the isolated test database | Create returns 201 and record is readable | Passed | PASS |
| API-02 | Project validation | Omit required project name | HTTP 400 validation error | Passed | PASS |
| API-03 | Duplicate project | Create a second project with the same name using different capitalization | HTTP 409 duplicate | Passed | PASS |
| API-04 | Package identity | Create same package name in npm and PyPI, then duplicate one identity | Cross-ecosystem records allowed; duplicate identity returns 409 | Both ecosystem records created; duplicate rejected with 409 | PASS |
| API-05 | Package validation | Omit a required package field | HTTP 400 validation error | Passed | PASS |
| API-06 | Dependency create | Create direct and transitive dependency records | HTTP 201 and records appear in graph | Passed | PASS |
| API-07 | Dependency uniqueness | Recreate the same project/source/target edge | HTTP 409 duplicate | Passed | PASS |
| API-08 | Unknown reference | Use a valid ObjectId format that does not identify a stored package | HTTP 404, no dangling edge | Passed | PASS |
| API-09 | Malformed ID | Send a malformed ObjectId | HTTP 400 | Passed | PASS |
| API-10 | Cycle behavior | Add the reverse package edge to form a cycle | Stored cycle is returned and graph traversal terminates | Cycle accepted; four initial graph edges were returned and browser graph rendered | PASS |
| API-11 | Unknown range/version | Store not-a-version, latest, and workspace:* fixtures | Version/range analysis stays unknown | Invalid installed version and unsupported constraints showed insufficient/unknown status | PASS |
| API-12 | Vulnerability match | Same package name in npm and PyPI, with a sample note | Note only matches matching ecosystem/package identity | npm candidate matched; same-name PyPI candidate did not | PASS |
| API-13 | Affected range change | Change installed version from 2.0.0 to 2.2.0 with recorded comparison 2.1.0 and note range <2.1.0 | Comparison state and affected match update | Version became at-or-above comparison; note became not affected | PASS |
| API-14 | Advisory validation | Duplicate identifier and mark a note verified without a URL | Duplicate 409; verified-without-URL 400 | Both responses matched expected status | PASS |
| API-15 | Severity filter | Filter recorded notes to High | Only matching High-severity record returned | One test fixture returned | PASS |
| API-16 | Project cascade deletion | Delete a project with one dependency link | Project and its links deleted; global package retained | One link removed, project GET returned 404, package remained readable, project link list empty | PASS |
| API-17 | Package cascade deletion | Delete the npm core package targeted and sourced by two links with an attached note | Two links and one note removed; package absent; no dangling graph node | RemovedDependencies=2, RemovedVulnerabilities=1, package GET 404, graph reference count 0 | PASS |
| API-18 | Empty project | Request graph and analytics for zero-link project | Root-only graph, zero edges, score null/Not assessed | Passed in API response and displayed empty project state | PASS |
| API-19 | Portfolio calculations | Four-edge fixture with three risky edges, then update and package deletion | Score recalculates from 25 to 50 and stays 50 after two edges/one risky edge | API metrics and refreshed dashboard showed the corresponding recalculation | PASS |
| UI-01 | Search | Search main inventory for pydantic | Matching package row is shown | One matching record shown | PASS |
| UI-02 | Status filter | Select Behind comparison on the main inventory | Only package records behind their stored comparison are shown | Seven matching package records shown; filter is based on global package records, including unlinked packages | PASS |
| UI-03 | Graph selection | Select Data Services and FastAPI on main dashboard | Stored edges render; selected details show one-hop relations | Two package nodes and three edges shown; FastAPI showed one direct dependency and zero package dependents | PASS |
| UI-04 | CSV export | Click Export CSV on the Dependencies page connected to the isolated database | Browser receives a CSV download | Download event completed and produced depgraph-dependencies (1).csv in the user Downloads folder | PASS |
| UI-05 | Reload consistency | Refresh isolated acceptance dashboard after package cascade | Deleted package/edges are absent and totals match stored data | UI showed two package nodes, two links, one affected link, and health 50 | PASS |

The CSV file was generated from the disposable test database only. It is a local export in the Downloads folder, not a project screenshot or a main-database export.

## Browser-observed views

Actual application screens were viewed during testing: Overview, Projects, package version inventory, graph, selected-package detail, Vulnerabilities, Reports, and an empty-project graph. These observations were made in the local application, not mockups. Inline browser captures could be displayed, but no PNG files were saved under docs/screenshots; follow the manual capture guide before submission.

## Complications and resolutions

1. The first package-delete test harness used an internal MongoDB field name, _id, when the public API serializes it as id. That constructed an incomplete endpoint and returned 404 without deleting a record. The raw response was inspected, the harness was corrected to use id, and the package cascade then passed with the expected counts.
2. The first CSV selector attempt was on the Overview page, where Export CSV does not exist. The browser state was checked, the Dependencies page was opened, and the download test passed. This was a test navigation issue, not an application failure.
3. The default command sandbox could not access local MongoDB/loopback. The application checks were run with approved local access and through the browser. This was an environment permission issue, not an application error.
4. Screenshot file export was not available through the permitted capture path. No screenshots are claimed as saved; exact manual capture steps and filenames are in docs/screenshots/README.md.

## Not tested or not fully automated

- Not every browser CRUD form was re-driven in this final acceptance pass. Create/update/delete and validation paths were exercised through the API on the disposable database; graph, filtering, reports, empty state, reload, and CSV were exercised in the browser.
- This turn did not repeat a direct mongosh query of main collection documents. The main database connection and persisted records were observed through the app API and after browser refresh.
- The screenshot PNG files are pending manual capture and validation.
- No load, concurrency, backup/restore, authentication, or production deployment tests were run.
- No live registry lookup or advisory verification test exists because those integrations are not implemented.

