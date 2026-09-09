# Student Creator

This repository contains Google Apps Script projects managed with clasp.

Each Apps Script project lives in its own folder, with its own source files, clasp configuration, package scripts, and README.

## Scripts

| Folder | Apps Script project | Purpose |
| --- | --- | --- |
| `secretaria_form/` | `secretaria_form` | First GAS project. Uses Dinantia API credentials and the shared spreadsheet database registry. |
| `students_creator_panel/` | `students_creator_panel` | Admin panel for processing pending student creation rows. |

## Shared Documentation

| Path | Purpose |
| --- | --- |
| `docs/SHARED_SPREADSHEET_DATABASE.md` | Shared spreadsheet registry pattern. |
| `docs/DINANTIA_API_NOTES.md` | Dinantia API overview, endpoints, auth, and security notes. |

## Repository Rules

- Keep one folder per Apps Script project.
- Keep `.clasp.json` files local and uncommitted.
- Store secrets only in Apps Script script properties.
- Resolve spreadsheet tables through the shared `db -> tables` registry.
