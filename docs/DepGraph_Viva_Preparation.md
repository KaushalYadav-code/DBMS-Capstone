# DepGraph Viva Preparation

## Two-minute project explanation

DepGraph is a local software dependency management and analysis prototype. A software project can contain many third-party packages, and it can be difficult to maintain one record of package versions, licenses, dependency links, and known risk notes. DepGraph stores project, package, dependency, and vulnerability-note documents in MongoDB and exposes them through a Node.js and Express REST API.

The frontend is an HTML page with CSS and vanilla JavaScript. It calls the local API with Fetch requests. The Dependencies page shows a package inventory and a directed graph generated from stored dependency records. Package versions can be compared with a comparison version saved in the dataset. The dashboard can match stored vulnerability notes by package name, ecosystem, and supported affected-version range. It clearly labels sample or unverified notes and does not claim to scan packages or download live advisory data.

The Reports page calculates counts and a simple project health score. A dependency link is considered risky when it has a maintainer review label, its installed version is behind a recorded comparison, or an active matching note says that version is affected. The score is the rounded percentage of links without those risk flags. It is not severity-weighted, and a project with no links is Not assessed.

The project demonstrates CRUD operations, relationships, validation, indexes, filtering, graph traversal, and aggregation with a document database. Acceptance checks covered the five automated analysis tests, CRUD and invalid references on a disposable MongoDB database, version changes, vulnerability identity, deletion cascades, an empty project, cyclic relationships, refresh consistency, CSV export, and the unavailable-database UI. Live scanning, registry lookups, authentication, and production hardening are future work rather than implemented features.

## Problem, motivation, and objectives

Dependencies are useful but add records that teams must track: names, ecosystems, versions, licenses, relationships, and known risks. DepGraph gives a small project a central inventory and makes stored relationships and analysis visible.

Objectives:

1. Provide CRUD for projects, package versions, dependency links, and vulnerability notes.
2. Represent direct project dependencies and package-to-package edges.
3. Visualize stored graph data and inspect immediate dependencies/dependents.
4. Compare installed and explicitly recorded comparison versions without guessing.
5. Match stored notes against package identity and supported affected ranges.
6. Calculate portfolio and per-project summaries from current database records.
7. Demonstrate MongoDB references, uniqueness constraints, filtering, and aggregate-style application logic.

## Technology choices

- **MongoDB:** document collections fit project/package records whose optional metadata can vary; ObjectIds link documents and compound/unique indexes enforce key identities and speed common lookups. This is a local educational choice, not a claim that MongoDB is always superior to a relational database.
- **Node.js:** JavaScript is used in both the frontend and backend, and Node provides the runtime for the REST API and test runner.
- **Express:** route and HTTP-method handlers map REST requests to validation and database operations.
- **HTML, CSS, vanilla JavaScript, SVG:** the project keeps the existing frontend in one HTML file and uses native browser APIs to request data and draw the graph.
- **Fetch API:** browser code sends JSON requests to Express; MongoDB credentials and connection details remain on the server.

## Architecture and database

The browser loads index.html from the local Express server. The page calls /api endpoints. Express validates input, uses the MongoDB Node.js driver, and returns JSON. Four collections are used:

- **projects:** name, normalized name key, description, ecosystem, owner, repository, and timestamps.
- **packages:** name, installed version, ecosystem, license, description, optional comparison version, and timestamps.
- **dependencies:** project ID, nullable source package ID, target package ID, direct/transitive type, declared constraint, stored review status, and timestamps.
- **vulnerabilities:** package ID, identifier, severity, description, affected-version expression, remediation note, status, evidence label, optional source URL, and timestamps.

A dependency whose source package ID is null points from the project root to a target package. A non-null source creates a package-to-package edge. Package records are global and can be linked into multiple projects. A vulnerability note is attached to one package record and is matched to candidates by the same case-insensitive name and ecosystem.

Unique indexes protect normalized project names, package name/version/ecosystem identity, dependency project/source/target identity, and vulnerability identifiers. Other indexes support ecosystem/license, dependency lookup, and vulnerability status/severity filters. Startup applies the existing migration and index setup.

See [Architecture and Data Model Diagrams](DepGraph_Architecture_Diagrams.md) for Mermaid diagrams.

## How dependency graph generation works

1. The UI requests the selected project graph from /api/graph.
2. The API reads that project's dependency records and the referenced package records.
3. It creates one synthetic project root node and one node for each linked package.
4. A null source package ID maps to the root; otherwise the source package node is the edge source.
5. The API includes stored version analysis and matching vulnerability-note metadata.
6. The SVG renderer draws the directed edges. Selecting a node requests or uses selection data for its direct outgoing package dependencies, incoming package dependents, project-root memberships, and notes.

The graph only reflects stored links. It does not infer dependency edges from manifests. The API allows cycles, but graph layout uses a visited-depth map so repeated traversal terminates. Self-dependencies are rejected.

## Version and vulnerability analysis

Each package can have an installed version and optional comparisonVersion. The comparison is dataset information, not a current version lookup. The custom parser compares SemVer-like values and supports common exact/partial/wildcard forms, caret, tilde, comparison operators, conjunctions, alternatives, and hyphen ranges. Unsupported forms and missing or invalid values return unknown instead of a guessed status. Ecosystems may have different conventions, so this is a limited parser.

A vulnerability record references a package. Candidate records match only when normalized ecosystem and package name agree. The affectedVersions expression is evaluated when supported. The result is affected, not affected, or range unknown. Resolved and Accepted records are inactive for health risk matching; open notes remain active.

Evidence labels are sample, unverified, or verified. A sample label means demonstration data. A verified label requires an HTTP(S) URL but is a user assertion: the app does not fetch, authenticate, or evaluate that source. No live scan or advisory feed exists.

## Health-score formula

For each dependency link, set one risk flag if any of these is true:

- the stored review status is review;
- the target package is behind its parseable comparison version; or
- an active matched vulnerability note says the installed version is affected.

A link with multiple flags counts once. For N links and R risky links:

**Health score = round(100 × (N − R) / N).**

If N is zero, the score is null and the UI displays Not assessed. Example: if a project has 4 links and 3 are risky, the score is 25. When the affected package version is updated outside the stored affected range, affected links can decrease and the score recalculates. The score does not weight severity, uncertainty, exploitability, or dependency reachability; it is an educational summary, not a security rating.

## Validation, errors, and deletion behavior

Routes validate required text, maximum lengths, enumerated fields, HTTP(S) URLs, and MongoDB ObjectId format. Dependency creation verifies that the project and package references exist, a transitive source is already in the project, a direct link has no source package, and source and target differ. Unique indexes prevent duplicate identities and edges.

Typical statuses are 400 for invalid/missing fields or malformed IDs, 404 for valid IDs that do not exist, 409 for duplicate records, and 503 when MongoDB is unavailable. The global error middleware avoids returning raw 500 exception details.

Deleting a project removes its dependency links but keeps global package records. Deleting a package removes links where it is source or target and vulnerability notes attached to that package. The acceptance test verified these counts. These multi-collection operations are not wrapped in a MongoDB transaction, so production use would need a transaction or cleanup strategy if partial failure recovery were required.

## Testing performed and limitations

Five Node.js automated tests passed. Backend and inline frontend syntax checks passed. Manual API tests on a disposable database covered creation, duplicate handling, missing fields, unknown references, direct/transitive edges, a cycle, version update behavior, ecosystem-aware note matching, evidence validation, severity filtering, empty graph, health calculations, project deletion, and package cascades. Browser checks covered the main dashboard, search/status filtering, graph selection, reports, empty state, refresh consistency, disconnected state, and CSV download.

Detailed actions and results are in [Acceptance Test Results](Acceptance_Test_Results.md). Test fixtures were isolated from the main depgraph database. Browser CRUD for every entity was not completely re-run; the database test data was verified via API and dashboard refresh rather than by a new direct mongosh inspection. PNG screenshot files remain pending manual capture.

## Current limitations and future scope

### Implemented

- Local project/package/dependency/vulnerability-note CRUD.
- Stored directed graph and selected-package detail.
- Comparison-version analysis and supported range checks.
- Stored vulnerability-note matching with evidence labels.
- Dashboard, reports, health formula, filters, and CSV export.
- MongoDB validation, indexes, connection health, and unavailable-database handling.

### Proposed, not implemented

- Import dependencies from package manifests, lockfiles, or SBOM formats.
- Retrieve current versions and advisories from trusted registries/data sources.
- Verify advisory provenance and retain source update history.
- Add authentication, authorization, audit records, backups, and production deployment hardening.
- Add broader automated browser/integration testing, performance measurements, and severity-weighted or explainable risk models.
- Split the frontend into multiple modules if the single-page capstone constraint changes.

## Viva questions and concise answers

### Core project and design

1. **What is DepGraph?** — A local dependency inventory and analysis prototype that stores projects, packages, dependency edges, and vulnerability notes in MongoDB.

2. **What problem does it address?** — It centralizes package versions, licenses, relationships, and recorded risk notes so maintainers can inspect them and see project summaries.

3. **Why did you choose this project?** — It combines a CSE software-engineering problem with database modeling, CRUD, references, filtering, graph data, and analytics.

4. **What are the main objectives?** — Manage records, visualize stored dependencies, compare versions, match recorded notes, and calculate project reports.

5. **What is the project scope?** — Local, single-user management and analysis of manually recorded or seeded data. It is not a live security scanner.

6. **Why use MongoDB?** — The four document collections can hold optional descriptive metadata while ObjectIds represent links. The project also demonstrates indexes and aggregation-style analysis. A relational design could also work.

7. **Why Node.js and Express?** — Node runs the JavaScript backend and Express maps HTTP methods and paths to API handlers. JavaScript is also already used in the browser.

8. **Why is there only one frontend file?** — The project requirement keeps HTML, CSS, and vanilla JavaScript together in index.html. Backend routes remain separate to keep database access server-side.

### HTTP, CRUD, and database

9. **What is a REST API?** — An HTTP interface that exposes resources through URLs and methods such as GET, POST, PUT, and DELETE.

10. **What does CRUD mean here?** —  Create, read, update, and delete project, package, dependency, and vulnerability-note records.

11. **How does the browser talk to MongoDB?** —  It does not. Fetch sends JSON requests to Express; Express uses the MongoDB driver.

12. **What collections are in the database?** —  projects, packages, dependencies, and vulnerabilities.

13. **How are projects related to packages?** —  The dependencies collection stores a project ID and target package ID. A null source package ID means the project directly depends on that package.

14. **How are transitive dependencies represented?** —  A dependency document includes a source package ID, a target package ID, and the project ID.

15. **Are package records stored separately for every project?** —  No. Package records are global; dependency records connect them to one or more projects.

16. **Why are indexes used?** —  Unique indexes enforce project, package, edge, and vulnerability identity rules. Lookup indexes support common filters and relationship queries.

17. **What status does an invalid request receive?** —  Most field or malformed-ID validation errors return 400; unknown records return 404; duplicates return 409; an unavailable database returns 503.

18. **What happens when a project is deleted?** —  Its dependency links are deleted. Global package records and package notes remain.

19. **What happens when a package is deleted?** —  Edges where it is source or target and vulnerability notes attached to it are removed. The package is then deleted.

### Intelligence and reporting

20. **How is the dependency graph generated?** —  The graph route reads stored links and package records, maps them to nodes and directed edges, and returns graph JSON for the SVG renderer.

21. **Does the graph find missing dependencies?** —  No. It visualizes only dependency records that exist in MongoDB.

22. **Can the graph contain cycles?** —  Yes. The API allows package cycles; the frontend uses visited-node tracking to prevent unbounded layout traversal. Self-dependency is rejected.

23. **How does version comparison work?** —  It compares the installed version with comparisonVersion stored in the dataset. It does not ask npm, PyPI, or another registry for a latest version.

24. **What happens with an invalid version or unsupported range?** —  The result is unknown/insufficient data. DepGraph avoids calling it outdated or affected based on a guess.

25. **How are vulnerabilities matched?** —  The record's referenced package is compared with candidate package name and ecosystem. A supported affected range is then applied to the installed version.

26. **Are vulnerability records verified by the application?** —  No. Evidence labels say sample, unverified, or user-marked verified. A URL is required for the verified label, but its authenticity is not checked.

27. **What is the health-score formula?** —  Round 100 times links without risk flags divided by total links. A link is risky if review-marked, behind a stored comparison, or affected by an active matching note.

28. **Why is an empty project's score not 0?** —  There are no links and therefore no denominator. The correct application state is Not assessed.

29. **Does severity affect the health formula?** —  No. Severity is displayed in findings, but the current formula treats each risky link equally.

30. **How does search/status filtering work?** —  The UI sends filter parameters to the API or filters the loaded dataset. Behind-comparison status can include global package records without a project link, while project health uses only that project's links.

### Testing and future work

31. **What tests were run?** —  Five Node.js unit tests passed; syntax checks passed; API tests used a disposable MongoDB database; browser checks covered graph, search, reports, empty state, reload, offline status, and CSV export.

32. **Why use a disposable database?** —  Destructive tests such as package/project deletion need test fixtures without risking the main depgraph records.

33. **What does the app show if MongoDB is down?** —  The page still loads, shows a disconnected message and zeroed summaries, and the health endpoint returns 503. It does not substitute fake browser data.

34. **What are the main limitations?** —  No authentication, live registry lookup, manifest/SBOM importer, advisory-feed synchronization, independent advisory verification, or production deployment hardening.

35. **What would you implement next?** —  First, add safe manifest/SBOM import and source-backed version/advisory integrations, then add authentication, auditability, robust browser tests, and a carefully explained risk model.


