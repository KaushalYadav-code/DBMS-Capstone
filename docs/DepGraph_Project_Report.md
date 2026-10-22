# DepGraph — Software Dependency Intelligence & Management System

## 1. Title page information

**College/Institution:** [Enter college or institution name]<br>
**Department:** [Enter department]<br>
**Course/Programme:** [Enter course or programme]<br>
**Project title:** DepGraph — Software Dependency Intelligence & Management System<br>
**Student name:** [Enter student name]<br>
**Roll number:** [Enter roll number]<br>
**Supervisor/Guide:** [Enter supervisor name]<br>
**Academic year:** [Enter academic year]<br>
**Submission date:** [Enter submission date]

## 2. Abstract

Modern software projects use packages maintained outside the project team. As inventories grow, tracking versions, licenses, dependency relationships, and recorded security notes becomes difficult. DepGraph is a local educational web application that stores project, package, dependency, and vulnerability-note records in MongoDB. A Node.js and Express API validates requests and provides the browser with JSON data. The single-page frontend displays project and package inventories, a dependency graph, version comparisons, stored vulnerability matches, and health reports.

The graph is generated from dependency edges actually stored in MongoDB. Version status compares an installed version with an explicitly recorded comparison version; it does not query package registries. Vulnerability matching compares stored package identity and evaluates an affected range only when the local parser supports it. Sample and unverified notes are distinguished from notes a user marks verified. The application does not perform live scanning or independently validate advisories.

DepGraph demonstrates CRUD operations, document references, indexes, validation, filtering, graph representation, and analytics. Five automated intelligence tests passed, and API/browser acceptance checks were run against an isolated test database and the local app. Screenshot image files remain a manual submission task.

## 3. Introduction

Third-party packages provide functionality without requiring each project to implement it from scratch. They also create information that maintainers need to track: the package identity, installed version, license, relationship to other packages, declared version constraint, and any risk note that has been recorded.

DepGraph stores that information and presents it in a local dashboard. Its focus is data management and transparent analysis of stored records. The system can make relationships and review signals easier to see, but its results are limited to data entered by a user or inserted through the explicit sample-data command.

## 4. Problem statement

As software projects grow, package information can be spread across manifests, spreadsheets, source files, and informal notes. Without a central record, it is harder to answer which packages a project depends on, which other packages they depend on, what comparison version is recorded, or whether a stored risk note applies to an installed version.

The problem addressed is the need for a small centralized system that can manage dependency records and calculate transparent summaries from those records without implying that manually entered data is live or independently verified.

## 5. Motivation and significance

DepGraph was selected because it is relevant to software engineering and provides a meaningful database-management problem. It uses CRUD operations, unique and lookup indexes, document references, filtering, validation, aggregation-style analytics, and graph relationships. The project also exposes limits clearly: a stored comparison is not a registry lookup, and a stored vulnerability note is not a scan result.

The project is suitable for a capstone demonstration because the data lifecycle can be explained from browser input through API validation and persistence to graph/report output.

## 6. Project objectives

1. Manage multiple software projects and their package inventories.
2. Store package name, version, ecosystem, license, description, and optional comparison version.
3. Represent direct project dependencies and package-to-package dependency edges.
4. Visualize stored graph records and inspect a package's immediate dependencies and dependents.
5. Compare parseable installed versions with comparison versions recorded in the dataset.
6. Match vulnerability notes using package ecosystem, package identity, and supported affected-version rules.
7. Calculate project and portfolio metrics from current MongoDB records.
8. Demonstrate API validation, duplicate protection, filtering, and deletion behavior.

## 7. Project scope

The delivered application is a local, single-user prototype. It manages four MongoDB collections and exposes the data through an Express API. The browser interface remains in one index.html file and includes Overview, Projects, Dependencies, Vulnerabilities, and Reports sections.

Included analysis uses only stored records. Comparison versions can be entered manually or come from the explicit demonstration seed. Vulnerability notes can be manually recorded or seeded as samples. The graph uses stored edges.

Outside scope are authentication, public deployment, package-manifest or SBOM import, live package-registry queries, advisory-feed synchronization, independent advisory verification, and a calibrated security score.

## 8. Existing-system limitations

A manual list or spreadsheet can store package names and versions but does not naturally enforce identity rules, link packages to multiple projects, or generate a graph and portfolio metrics from current records. A source package manifest can describe dependencies but does not by itself provide a central inventory across projects or contain DepGraph's manually entered review notes.

This comparison describes the limitations of a basic manual workflow, not a measured comparison against a named commercial tool. DepGraph is a teaching prototype and is not a replacement for mature software-composition-analysis products.

## 9. Proposed-system overview

The user opens the local dashboard. The frontend calls JSON endpoints on the Express server. Express validates incoming fields and references, uses the MongoDB driver to read or change records, and returns resource data. The dashboard then refreshes its tables, graph, or summary cards.

Four collections separate the main entities. A dependency document connects a project to a target package and may identify a source package. The graph route turns those records into nodes and edges. The analytics module calculates counts and the health score from current packages, edges, and vulnerability notes.

## 10. Functional requirements

- Create, list, search, update, and delete projects.
- Create, list, search, filter, update, and delete package records.
- Create, list, filter, update, and delete dependency edges.
- Create, list, filter, update, and delete vulnerability notes.
- Enforce required fields, enumerated values, valid ObjectIds, URL format, and uniqueness rules.
- Return graph nodes and directed edges for a selected project.
- Return immediate package dependency/dependent details for a selected graph package.
- Compare installed and recorded comparison versions and evaluate supported constraints.
- Match stored vulnerability notes to package identity and affected-version range.
- Display dashboard, license, severity, and project-health metrics.
- Export inventory data as CSV.
- Display an empty state when MongoDB is unavailable and report health through an endpoint.

## 11. Non-functional requirements

- **Usability:** provide a local dashboard with separate project, dependency, finding, and report views.
- **Data integrity:** use ObjectId references, required-field validation, unique indexes, and duplicate response codes.
- **Maintainability:** separate API routes and intelligence logic in backend modules while keeping the requested frontend in one file.
- **Availability for local demonstration:** retry MongoDB connection and show a disconnected state rather than substitute browser data.
- **Security boundary:** bind the documented server to loopback and keep database configuration on the server. Authentication and production hardening are not included.
- **Clarity:** label unknown version/range results as unknown, and distinguish sample/unverified notes from user-marked verified notes.

No performance or scalability benchmark is claimed.

## 12. Technology stack and justification

| Technology | Use in DepGraph |
| --- | --- |
| HTML and CSS | Page structure and styling |
| Vanilla JavaScript | Browser state, Fetch requests, forms, filtering, tables, SVG graph, CSV generation |
| Node.js 20+ | Backend JavaScript runtime and built-in test runner |
| Express 5 | HTTP routing, middleware, JSON handling, and error responses |
| MongoDB Community Server | Persistent document database |
| MongoDB Node.js driver | Connection, CRUD, queries, and index operations |

MongoDB is used because the application models distinct document collections and references them by ObjectId. Express provides the route layer between the browser and database. JavaScript on both sides keeps the implementation stack consistent. These are project-specific reasons, not claims that this stack is optimal for every dependency-management system.

## 13. System architecture

The browser loads index.html from Express and uses Fetch over HTTP. The Express application validates and routes requests, then uses the official MongoDB Node.js driver. MongoDB stores the four collections. The browser does not receive MongoDB credentials or connect directly to the database.

~~~mermaid
flowchart LR
    U[User] --> B[Browser and index.html]
    B -->|Fetch JSON| E[Express REST API]
    E --> V[Validation and route handlers]
    V --> D[MongoDB Node.js driver]
    D --> M[(MongoDB depgraph)]
    M --> P[(projects)]
    M --> K[(packages)]
    M --> G[(dependencies)]
    M --> F[(vulnerabilities)]
    P --> D
    K --> D
    G --> D
    F --> D
~~~

See [DepGraph Architecture Diagrams](DepGraph_Architecture_Diagrams.md) for the data model and dependency-creation sequence diagram.

## 14. Module descriptions

- **Frontend, index.html:** dashboard layout, forms, navigation, search/status filters, graph rendering, API requests, and CSV exports.
- **Application setup, server/src/app.js:** Express middleware, route registration, health endpoint, static dashboard response, and error formatting.
- **Database access, server/src/db.js:** MongoClient connection, connection state, legacy document migration, indexes, ping, and shutdown.
- **Startup, server/src/server.js:** loopback HTTP server, MongoDB retry behavior, and graceful shutdown.
- **Projects route:** project CRUD, normalized project-name uniqueness, search, and deletion of project edges.
- **Packages route:** global package CRUD, identity uniqueness, filters, and package-deletion cascades.
- **Dependencies route:** edge CRUD, reference validation, duplicate-edge handling, and project/source rules.
- **Graph route:** project graph construction, node-level intelligence, and package selection details.
- **Vulnerabilities route:** note CRUD, evidence metadata, package/range matching, and filtering.
- **Intelligence modules:** SemVer-like parser, version comparison, evidence classification, vulnerability match classification, and portfolio analytics.
- **Seed script:** explicitly upserts demonstration data; it is not called by application startup.
- **Tests:** five automated tests covering analysis semantics and health calculations.

## 15. Database schema and collection descriptions

| Collection | Fields | Description |
| --- | --- | --- |
| projects | _id, name, nameKey, description, ecosystem, owner, repository, createdAt, updatedAt | Project metadata; nameKey is a normalized unique name |
| packages | _id, name, version, ecosystem, license, description, comparisonVersion, createdAt, updatedAt | Global package-version records; identity is name/version/ecosystem |
| dependencies | _id, projectId, sourcePackageId, targetPackageId, dependencyType, versionConstraint, reviewStatus, createdAt, updatedAt | Project membership or package-to-package dependency edge |
| vulnerabilities | _id, packageId, identifier, severity, description, affectedVersions, recommendedAction, status, verificationStatus, sourceUrl, createdAt, updatedAt | User-recorded or sample risk note attached to a package |

The sourcePackageId dependency field can be null. Comparison version and source URL are optional. Evidence labels are sample, unverified, and verified. The verified value requires a supplied HTTP(S) URL, but DepGraph does not validate that source.

## 16. Relationships between collections

Projects and packages are associated through dependency documents. The projectId points to a project. targetPackageId points to the package being depended on. A null sourcePackageId means the project itself is the source. A non-null sourcePackageId represents a package-to-package edge.

Package documents are global and may appear in multiple project dependency lists. Vulnerability documents reference one package by packageId; candidate packages are matched using the referenced package's name and ecosystem. Deleting a project removes its dependency documents. Deleting a package removes edges where it appears as source or target and notes attached to that package.

Unique indexes enforce normalized project names, package name/version/ecosystem identity, project/source/target edge identity, and vulnerability identifiers. Additional indexes support ecosystem/license, project/target, source-package, package/status, and severity/status queries.

## 17. API design and important endpoints

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| /api/health | GET | Connection state and selected database name; returns 503 when disconnected |
| /api/dashboard | GET | Totals, health, project rows, license distribution, and severity counts |
| /api/graph?projectId=... | GET | Stored graph nodes and edges; packageId adds selection details |
| /api/projects | GET, POST | List/search or create a project |
| /api/projects/:id | GET, PUT, DELETE | Read, update, or delete a project |
| /api/packages | GET, POST | List/filter or create a package |
| /api/packages/:id | GET, PUT, DELETE | Read, update, or delete a package |
| /api/dependencies | GET, POST | List/filter or create an edge |
| /api/dependencies/:id | GET, PUT, DELETE | Read, update, or delete an edge |
| /api/vulnerabilities | GET, POST | List/filter or create a note |
| /api/vulnerabilities/:id | GET, PUT, DELETE | Read, update, or delete a note |

Normal resource responses use a data wrapper. Errors include a code and message. The health endpoint returns connection information directly. List endpoints support a limit up to 500.

## 18. Dependency graph generation logic

The graph endpoint reads dependency records for one project and fetches the referenced packages and vulnerability notes. It creates a project-root node, package nodes, and one directed edge per valid stored relationship. Null source IDs become root-to-package edges. Dangling target references and edges with missing non-null source packages are omitted defensively.

For a selected package, the endpoint reports its outgoing package dependencies, incoming package dependents, direct project memberships, and matched notes. The frontend renders the graph in SVG. Layout traverses the graph with visited-depth tracking so cycles do not cause infinite traversal. The graph is a representation of stored relationships, not an inferred dependency resolver.

## 19. Version comparison logic and limitations

For each package, DepGraph compares its installed version to comparisonVersion. If the installed version sorts lower, it is behind comparison; otherwise it is at or above comparison. Both values must parse. Missing or invalid data is unknown and does not count as outdated.

The parser handles semantic version core values, prerelease ordering, exact versions, partial and wildcard forms, caret and tilde ranges, comparison operators, conjunctions, alternatives with ||, and inclusive hyphen ranges. A recorded dependency constraint is evaluated against the comparison version where supported.

The comparison version is manually recorded or part of explicit demonstration data. It is not retrieved from npm, PyPI, or another registry. The parser is a limited SemVer-style implementation, not an authoritative complete implementation of each ecosystem's constraint rules. Unsupported syntax such as workspace protocols is left unknown.

## 20. Vulnerability matching logic and data provenance

A vulnerability record references a package document. The match classifier compares candidate packages by trimmed, case-insensitive ecosystem and package name. If identities match, it applies the stored affected-version expression to the candidate's installed version. The result can be affected, not affected, or range unknown.

Resolved and Accepted notes are excluded from active health-risk matching. Other statuses are active. The UI displays identifier, severity, affected-version text, remediation notes, status, and evidence label.

Seeded demonstration records use DG-DEMO identifiers and sample wording. New records default to unverified unless the user chooses another allowed evidence value. A verified label requires an HTTP(S) URL, but the application does not fetch the URL or verify ownership, current status, or authenticity. Therefore, an affected result means only that stored identity and range rules matched. It is not proof of an actual vulnerability.

## 21. Project health-score formula, examples, and limitations

For each project dependency link, the implementation sets a risk flag if any condition is true:

1. The stored reviewStatus is review.
2. The target package is behind a parseable comparisonVersion.
3. An active vulnerability note matches the package and the installed version is inside its supported affected range.

Multiple flags on the same link still count as one risky link. Let N be the project's dependency-link count and R be its risky-link count:

**Health score = round(100 × (N − R) / N).**

Example: N = 4 and R = 3 gives round(100 × (4 − 3) / 4) = 25. If one of the affected package versions changes so its stored note no longer matches, R may decrease and the score is recalculated from the database. If N = 0, the score is null and the interface displays Not assessed.

The score is not severity-weighted. It treats all dependency links equally, may count one package multiple times when it has multiple project edges, does not model exploitability or transitive reachability, and does not assess unknown versions/ranges as risky. It is a transparent project-management indicator, not a security grade or probability.

## 22. Input validation and error handling

The API checks required strings, maximum lengths, enumerated values, HTTP(S) URLs, and ObjectId syntax. Dependency routes check references, direct versus transitive requirements, project membership of a transitive source, duplicate edges, and self-dependency. MongoDB unique indexes remain the final guard against duplicate identities.

Typical responses: 400 for malformed or missing input, 404 for a well-formed reference that does not exist, 409 for duplicate records, 503 when MongoDB is unavailable, and a generic 500 response for unexpected server errors. JSON bodies are limited to 100 KB. Project deletion removes its links; package deletion removes related edges and notes. Those cascades are not wrapped in a multi-document transaction.

## 23. Testing methodology and actual test results

Testing used three layers:

1. Five automated Node.js tests for semantic-version ordering/ranges, insufficient version data, ecosystem-aware package identity, and portfolio health calculations.
2. Static syntax checks for 13 backend JavaScript files and the inline frontend script.
3. Manual API and browser acceptance checks using a disposable MongoDB database, plus read-only dashboard checks on the main local app.

All five automated tests passed. The integration checks covered CRUD and validation, duplicate handling, valid-but-unknown and malformed IDs, dependency graph edges and cycles, empty projects, invalid versions/ranges, package identity across ecosystems, stored-note matching, version updates, project/package deletion cascades, health recalculation, search/filtering, refresh consistency, CSV download, and unavailable MongoDB behavior.

The main database was not seeded, reset, dropped, or used for destructive acceptance actions. The disposable database was separate. A first delete-test attempt formed an invalid route because the harness used MongoDB's internal _id field rather than the public API's serialized id field; correcting the test harness led to a passing cascade test. This was not an application deletion failure.

Detailed test IDs, input/actions, expected and actual results, and limitations appear in [Acceptance Test Results](Acceptance_Test_Results.md). The checks did not include a load benchmark, production deployment test, or full browser-driven CRUD run for every form.

## 24. Results and screenshots

The verified implementation supports stored-data CRUD, directed graph display, version status, vulnerability-note matching, metrics, reports, search/status filters, and CSV export. Manual tests observed the main local dashboard after refresh, graph selection and details, the empty-project state, sample vulnerability labeling, report formula, disconnected database banner, and a successful CSV download from the disposable test dataset.

No PNG screenshot files are currently saved. The permitted browser capture workflow displayed real application views but did not provide an authorized project-file save operation. No images have been fabricated. Exact manual capture steps and required filenames are in [docs/screenshots/README.md](screenshots/README.md).

## 25. Known limitations

- No user authentication, roles, multi-tenant access controls, audit log, or production deployment configuration.
- No live registry version lookup, manifest/lockfile import, SBOM support, or advisory-feed ingestion.
- Vulnerability data is user-entered or seeded; source authenticity is not verified.
- Comparison and affected-range parsing supports common forms but does not cover every ecosystem specification.
- A health score is link-level, equally weighted, and not a calibrated security measure.
- Graph output depends on stored links and does not detect omitted dependencies.
- Package deletion cascades are multiple database operations without a transaction.
- Automated coverage is focused on pure intelligence calculations; full API/browser lifecycle automation is not part of the repository test suite.
- Screenshots and institutional front matter remain manual tasks.

## 26. Future enhancements

- Import dependency records from package manifests, lockfiles, or supported SBOM formats with user review.
- Integrate maintained package registry APIs for clearly timestamped comparison versions.
- Integrate trusted advisory sources and retain source links, timestamps, and provenance.
- Add authentication, authorization, audit logging, backups, and production deployment controls.
- Add integration/browser tests, migration tests, and performance measurement.
- Improve graph navigation for large projects and add cycle/path explanations.
- Investigate severity-weighted or explainable risk summaries while preserving a transparent formula.

These items are proposals only; they are not implemented in the delivered version.

## 27. Conclusion

DepGraph provides a working local application for managing project dependency data and explaining analyses derived from stored records. It demonstrates how MongoDB collections, indexes, Express routes, and a browser interface can support CRUD, graph visualization, version comparison, vulnerability-note matching, and reporting. Its principal limitation is data provenance: the application analyzes user-provided values and sample notes, not live package or advisory sources. The acceptance run found the automated analysis suite and the tested manual flows passing. PNG capture and completion of report placeholders remain necessary before final institutional submission.

## 28. References and technical resources

1. Express.js, “Routing.” https://expressjs.com/en/guide/routing/
2. MongoDB, “Configure CRUD Operations — Node.js Driver.” https://www.mongodb.com/docs/drivers/node/current/crud/configure/
3. MongoDB, “Indexes.” https://www.mongodb.com/docs/manual/indexes/
4. MongoDB, “Run the MongoDB Service on Windows.” https://www.mongodb.com/docs/manual/administration/run-mongodb-windows/
5. Node.js, “Test runner.” https://nodejs.org/api/test.html
6. Semantic Versioning, “Semantic Versioning 2.0.0.” https://semver.org/

The sources above document technologies and conventions used by the project. Project behavior and test results in this report are based on the current DepGraph source and the acceptance checks described herein.

