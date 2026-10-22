# Final Submission Checklist

Status uses **Complete**, **Pending**, or **Not tested**. A pending screenshot task is not presented as done.

## Application and database

- [x] README startup command matches the server package script: npm start from server/.
- [x] Local dashboard served at http://127.0.0.1:3000 during acceptance work.
- [x] Main application API reported MongoDB connected to database depgraph.
- [x] Dashboard loaded records after page refresh; the existing persisted project and current inventory remained visible.
- [x] Separate unavailable-database test returned HTTP 503 from /api/health; the dashboard itself returned HTTP 200 and showed a disconnected state with zeroed metrics.
- [x] Destructive API tests were confined to the named disposable Phase 6 database; the main depgraph database was not seeded, reset, dropped, or used for destructive tests.
- [x] .gitignore excludes server/.env and .env.

## CRUD, validation, and persistence

- [x] Create and read project records through the API; duplicate project name returned HTTP 409.
- [x] Create package records, including the same name in two ecosystems; package identity duplicates returned HTTP 409.
- [x] Missing required project/package fields returned HTTP 400.
- [x] Update package version and observe the comparison analysis change in later API/report results.
- [x] Create direct and transitive dependency records; duplicate edge returned HTTP 409.
- [x] A valid-form but unknown referenced package ID returned HTTP 404; a malformed ObjectId returned HTTP 400.
- [x] Project deletion removed the project's links and retained global package records.
- [x] Package deletion removed attached links and vulnerability notes; a subsequent lookup returned 404.
- [ ] Browser-driven CRUD forms for every entity were not all re-run during this acceptance pass.
- [ ] A direct MongoDB shell inspection of persisted test records was not repeated in this phase; database persistence was confirmed through the connected API and page reload.

## Dependency intelligence and analytics

- [x] Graph nodes/edges came from stored project relationships; a selected package displayed one-hop dependencies and dependents.
- [x] Empty project returned a root-only graph, zero edges, and a Not assessed health value.
- [x] A cycle was present in the test graph; the API returned its stored edges and the frontend graph rendered without hanging.
- [x] Invalid installed version was shown as insufficient/unknown, not as outdated.
- [x] Unsupported constraints such as workspace:* and latest remained unknown instead of being guessed.
- [x] Ecosystem-specific vulnerability identity prevented an npm note from matching a same-name PyPI package.
- [x] A version change moved a note outside its stored affected range; evidence remained labeled as sample.
- [x] Health formula passed the unit fixture and API integration examples; zero-link projects remained Not assessed.
- [x] Search, behind-comparison filtering, graph selection, and report views were checked in the browser.
- [x] CSV export from the disposable database produced a browser download.

## Automated checks and documentation

- [x] npm test: 5 passed, 0 failed.
- [x] node --check passed for 13 backend JavaScript files.
- [x] Frontend inline JavaScript passed node --check in classic-script mode.
- [x] git diff --check and a trailing-whitespace scan of all seven deliverable Markdown files passed after documentation was written.
- [x] README, report, viva guide, architecture diagrams, acceptance results, and checklist are present.
- [x] .env values and credentials are not copied into the report or screenshots.

## Screenshots

- [ ] 01-dashboard.png — Pending manual capture.
- [ ] 02-project-management.png — Pending manual capture.
- [ ] 03-package-version-status.png — Pending manual capture.
- [ ] 04-dependency-graph.png — Pending manual capture.
- [ ] 05-selected-package-details.png — Pending manual capture.
- [ ] 06-vulnerability-risk-analysis.png — Pending manual capture.
- [ ] 07-project-health-report.png — Pending manual capture.
- [ ] 08-empty-project-state.png — Pending manual capture.
- [x] Exact capture instructions and filenames are listed in docs/screenshots/README.md.

## Viva and final review

- [x] Viva guide explains what is implemented and separates it from proposed extensions.
- [x] At least 25 source-grounded viva questions and concise answers are included.
- [ ] Student/institution placeholders in the report must be completed.
- [ ] Manually capture, open, and verify all eight PNG screenshots.
- [ ] Review the final report with the supervisor/course format and add page numbers, signatures, or front-matter required by the institution.

## Security and data handling

- [x] The server listens on loopback for the documented local setup.
- [x] API and database credentials remain on the server; the browser talks to the API, not MongoDB.
- [x] Vulnerability notes are described as sample/unverified/user-asserted; no live scanner claim is made.
- [x] Main database was not seeded or subjected to destructive acceptance operations.
- [ ] Before any public deployment, add authentication, authorization, hardened configuration, audit logging, backups, and a production deployment review; these are outside the current capstone scope.

## Readiness assessment

The application and source-grounded documentation are ready for a supervised demonstration. The project is **not fully submission-ready until the eight manual PNG captures are saved and the report placeholders/institutional formatting are completed**.
