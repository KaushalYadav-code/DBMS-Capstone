# DepGraph

**Software Dependency Intelligence & Management System**

DepGraph is a local educational capstone application for recording software projects, package inventories, dependency relationships, comparison versions, and vulnerability notes. It provides a graph view, stored-data analysis, project-health summaries, searchable tables, and CSV exports.

## Problem statement and objectives

Growing projects depend on packages with different versions, licenses, relationships, and recorded risk notes. DepGraph puts these records in one MongoDB database so a maintainer can review inventory and relationships in one place.

The project objectives are to:

- manage multiple projects and their package inventories;
- store packages and direct or package-to-package dependency links;
- visualize stored relationships and inspect direct dependencies and dependents;
- compare installed versions with comparison versions explicitly recorded in the dataset;
- match stored vulnerability notes to the same ecosystem/package identity and supported affected-version ranges;
- calculate project and portfolio summaries from MongoDB records; and
- demonstrate CRUD, filtering, aggregation, references, and indexes using a local REST application.

## Features

- Project, package, dependency, and vulnerability-note CRUD through the dashboard and REST API.
- A directed SVG dependency graph built from stored dependency edges.
- Semantic-version comparison against a manually recorded comparison version. The value is not fetched from a package registry and is not called “latest.”
- Supported common version constraints; unparseable versions and unsupported ranges remain unknown.
- Vulnerability matching by case-insensitive package name and ecosystem, followed by an affected-range check when the range is supported.
- Explicit evidence labels: sample, unverified, or user-marked verified. DepGraph does not validate the authenticity of a source URL.
- Dashboard counts, license and severity summaries, per-project health, search, status filters, and CSV export.
- A deliberate empty state for projects with no dependency links.

DepGraph is an inventory and analysis prototype. It does not scan source files, contact package registries, download advisories, or independently verify a vulnerability.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | index.html, css/styles.css, and browser-native vanilla JavaScript modules in js/ |
| API | Node.js 20 or newer, Express 5 |
| Database | MongoDB Community Server and the official Node.js driver |
| Browser/API communication | JSON REST endpoints and the Fetch API |
| Tests | Node.js built-in test runner |

## Folder structure

~~~text
.
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── api.js
│   ├── app.js
│   ├── csv.js
│   ├── forms.js
│   ├── helpers.js
│   ├── state.js
│   └── features/
│       ├── dashboard.js
│       ├── dependencies.js
│       ├── dependency-graph.js
│       ├── packages.js
│       ├── projects.js
│       ├── reports.js
│       └── vulnerabilities.js
├── README.md
├── .gitignore
├── docs/
│   ├── Acceptance_Test_Results.md
│   ├── DepGraph_Architecture_Diagrams.md
│   ├── DepGraph_Project_Report.md
│   ├── DepGraph_Viva_Preparation.md
│   ├── FINAL_SUBMISSION_CHECKLIST.md
│   └── screenshots/
│       └── README.md
└── server/
    ├── .env.example
    ├── package.json
    ├── package-lock.json
    ├── src/
    │   ├── app.js
    │   ├── db.js
    │   ├── seed.js
    │   ├── server.js
    │   ├── intelligence/
    │   │   ├── analysis.js
    │   │   └── semver.js
    │   └── routes/
    │       ├── dashboard.js
    │       ├── dependencies.js
    │       ├── graph.js
    │       ├── helpers.js
    │       ├── packages.js
    │       ├── projects.js
    │       └── vulnerabilities.js
    └── test/
        └── intelligence.test.js
~~~

The local server/.env file is excluded by .gitignore. Do not paste credentials into this README or commit the local environment file.

## Prerequisites

- Node.js 20 or newer and npm.
- MongoDB Community Server running locally and reachable at the URI in server/.env.
- A modern browser.

## Installation and startup

On Windows, open Services (services.msc), find the MongoDB service installed on the machine, and start it if it is stopped. If MongoDB was installed as the default Windows service, an elevated terminal can also use net start MongoDB. The service name depends on the installation. MongoDB's official Windows instructions describe service and manual startup options.

From the project directory, use PowerShell:

~~~powershell
Set-Location .\server
Copy-Item .env.example .env  # only if .env does not already exist
npm install
npm start
~~~

Open http://127.0.0.1:3000. The server binds to loopback (127.0.0.1), serves the frontend files from the project root, and uses same-origin relative `/api/...` requests. Do not open `index.html` using a `file:///` URL; browser requests from a local file cannot reach the Express API. The terminal reports the server as ready only after MongoDB connects. Until then, `/api/health` returns HTTP 503 and the dashboard explains whether the page cannot reach the API or MongoDB is disconnected.

The environment template contains:

~~~text
MONGODB_URI=mongodb://127.0.0.1:27017
DB_NAME=depgraph
PORT=3000
~~~

MONGODB_URI is the MongoDB server URI; DB_NAME selects the database; PORT selects the local HTTP port. The app retries MongoDB connection after startup if the database is unavailable, serves a visible disconnected state, and returns HTTP 503 from /api/health until a connection is available.

### Seeded demonstration data

The app does not seed automatically. To upsert the bundled demonstration records, run this explicitly from the server directory:

~~~powershell
npm run seed
~~~

This writes demonstration projects, package versions, dependency links, and three sample vulnerability notes into the database selected by the current .env. It is repeatable and does not drop collections, but it changes records in that selected database. Do not run it against the main depgraph database unless you intentionally want those demonstration records there. Seeded comparison versions and vulnerability notes are teaching fixtures, not claims about current releases or verified advisories.

## Using the dashboard

Use the sidebar to open Overview, Projects, Dependencies, Vulnerabilities, and Reports. Package creation may also add a direct dependency to the selected project. The Dependencies page contains the package registry, relationship table, graph, search/status filters, and package CSV export. The Reports page summarizes projects and explains the health formula. See [screenshot capture instructions](docs/screenshots/README.md); image files still need to be captured manually in this environment.

## Data model

MongoDB stores four collections. MongoDB ObjectIds identify documents. The API serializes them as id values.

| Collection | Main fields and purpose |
| --- | --- |
| projects | name, normalized unique nameKey, description, ecosystem, owner, repository, timestamps |
| packages | name, version, ecosystem, license, description, optional comparisonVersion, timestamps; identity is unique by name, version, and ecosystem |
| dependencies | projectId, nullable sourcePackageId, targetPackageId, dependencyType (direct or transitive), versionConstraint, reviewStatus, timestamps |
| vulnerabilities | packageId, identifier, severity, description, affectedVersions, recommendedAction, status, verificationStatus, sourceUrl, timestamps |

A dependency with no sourcePackageId is a direct project-to-package edge. A dependency with a source package is a package-to-package edge. Package records are global; the dependency collection associates them with projects. Vulnerability notes reference one stored package record. The server creates unique and lookup indexes at startup. Startup also applies the existing legacy-field migration where needed.

### Health score

The dashboard calculates a link-level score from current database records. A dependency link is counted as risky if its stored review label is review, its target package is behind a parseable recorded comparison version, or an active matching vulnerability note says the installed version is affected. Multiple risk signals on one link still count as one risky link.

**Score = round(100 × (dependency links − risky dependency links) ÷ dependency links).**

For two links with one risky link, the score is 50. A project with no links has no denominator and is shown as **Not assessed**. Missing or invalid comparison versions and unsupported affected ranges do not create a risk by themselves. The score is a simple educational summary: it is not severity-weighted and does not express a calibrated security probability.

## API

Successful resource responses are wrapped as { "data": ... }; errors use { "code": "...", "error": "..." }. /api/health is an unwrapped status object.

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| /api/health | GET | MongoDB connection and database name |
| /api/dashboard | GET | Portfolio totals, project health, license distribution, and severity totals |
| /api/graph?projectId=... | GET | Project graph nodes and edges; optional packageId returns one-hop selection details |
| /api/projects | GET, POST | List/search projects and create |
| /api/projects/:id | GET, PUT, DELETE | Read, update, or delete; project deletion removes its dependency links |
| /api/packages | GET, POST | List/filter or create a global package record |
| /api/packages/:id | GET, PUT, DELETE | Read, update, or delete; package deletion removes attached links and vulnerability notes |
| /api/dependencies | GET, POST | List/filter or create a dependency edge |
| /api/dependencies/:id | GET, PUT, DELETE | Read, update, or delete one edge |
| /api/vulnerabilities | GET, POST | List/filter or create a recorded note |
| /api/vulnerabilities/:id | GET, PUT, DELETE | Read, update, or delete one note |

List endpoints accept limit (default 100, maximum 500). Common validation failures return 400, missing records return 404, duplicate unique records return 409, and an unavailable database returns 503.

## Version and vulnerability rules

- Version status compares the installed version with comparisonVersion, a value stored by a user or the explicit seed. It does not query an ecosystem registry.
- The local parser supports exact and partial/wildcard versions, ^, ~, comparison operators, conjunctions, alternatives using ||, and hyphen ranges.
- Missing or unparseable installed/comparison versions produce an unknown state. Unsupported range syntax produces an unknown constraint or match instead of a guessed result. This is a limited SemVer-style parser, not a complete implementation of every ecosystem's version specification.
- Vulnerability matching requires the same package name and ecosystem (case-insensitive). If the affected range is supported, the installed version is classified as affected or not affected. The stored note's evidence label is shown separately.
- Verified is a user assertion. The API requires an HTTP(S) source URL for that label, but it does not visit the URL or validate the advisory.

## Verification

From the server directory:

~~~powershell
npm test
~~~

The automated suite currently contains five unit tests for SemVer ordering/ranges, insufficient version data, ecosystem-aware vulnerability identity, and health calculations. For Phase 6 acceptance evidence and limitations, see [Acceptance Test Results](docs/Acceptance_Test_Results.md). The current acceptance run also syntax-checked 13 backend JavaScript files and the inline frontend script.

## Limitations

- Local single-user prototype; no login, roles, or production deployment controls.
- No live package registry lookup, package manifest importer, SBOM ingestion, or advisory-feed synchronization.
- Comparison versions and vulnerability notes are manually recorded or seeded.
- A user can mark a note verified with a URL, but DepGraph does not authenticate it.
- Health treats links equally and counts a link once regardless of severity or number of flags.
- The graph displays stored links; it does not infer missing dependencies or explain why a cycle exists.
- Frontend code is intentionally kept in one index.html; browser end-to-end tests are not automated.
- PNG screenshot files have not been saved in docs/screenshots; follow the manual capture guide before submission.

## Technical references

- [Express routing guide](https://expressjs.com/en/guide/routing/)
- [MongoDB Node.js driver CRUD operations](https://www.mongodb.com/docs/drivers/node/current/crud/configure/)
- [MongoDB indexes](https://www.mongodb.com/docs/manual/indexes/)
- [Running MongoDB as a Windows service](https://www.mongodb.com/docs/manual/administration/run-mongodb-windows/)
- [Node.js test runner](https://nodejs.org/api/test.html)
- [Semantic Versioning 2.0.0 specification](https://semver.org/)
