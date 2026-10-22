# Screenshot Capture Guide

## Status

No PNG screenshot files are currently saved in this folder. The local browser tool could display actual application captures during this work, but the permitted capture path did not provide a project-file save operation. No replacement or mock screenshots were created. Capture the images manually before final submission.

## Capture setup

1. Start the local MongoDB service and the DepGraph server using the steps in the repository README.
2. Open http://127.0.0.1:3000 in a maximized browser window. Use the main DepGraph database, which already contains the project records used for the working demonstration. Do not run the seed command just for screenshots unless you intend to add those sample records to that database.
3. Keep the browser zoom at 100% and use the same window size for each image. Confirm the status badge says MongoDB connected.
4. For each view, press Win+Shift+S, select the application area, and save the PNG into this folder with the exact filename below. Use Snipping Tool's Save As command and choose PNG.
5. Do not include .env, credentials, unrelated browser tabs, or personal information. The local address 127.0.0.1 is safe to show.
6. After each save, open the file once to confirm that the text is readable and the image is not blank or clipped.

## Required filenames and views

| Filename | View to capture |
| --- | --- |
| 01-dashboard.png | Overview page with current summary cards and portfolio health |
| 02-project-management.png | Projects page with project list and management controls |
| 03-package-version-status.png | Dependencies page showing package versions and status labels |
| 04-dependency-graph.png | Dependencies page with a project selected and graph showing stored package edges |
| 05-selected-package-details.png | Same graph page with a package selected and its direct dependencies/dependents visible |
| 06-vulnerability-risk-analysis.png | Vulnerabilities page with the sample/unverified evidence label visible |
| 07-project-health-report.png | Reports page showing per-project counts, health values, and the formula description |
| 08-empty-project-state.png | Graph for a project with no dependencies, showing the root-only graph and zero links |

For the selected-package image, choose a package node or the Selected package dropdown. For the empty-state image, use an existing empty project if one is present, or create a clearly named empty project only if that change is wanted in the main database. Do not add or delete main-database records solely to obtain screenshots.

## Verification after capture

Confirm that all eight named files exist, have a non-zero size, use PNG format, and open successfully. Then replace this status section with the capture date and any filenames that could not be obtained. The application itself does not generate screenshot files.

