# Student Creator

This repository contains Google Apps Script projects managed with clasp.

Each Apps Script project lives in its own folder, with its own source files, clasp configuration, package scripts, and README.

## Scripts

| Folder | Apps Script project | Purpose |
| --- | --- | --- |
| `secretaria_form/` | `secretaria_form` | Internal form for submitting new-student creation requests into the shared database. |
| `students_creator_panel/` | `students_creator_panel` | Protected panel for processing pending rows, creating Google Workspace users, creating Dinantia students, and marking rows as managed. |

## Stable Web Apps

Always redeploy these existing deployment IDs so the URLs remain stable.

| Script | Deployment ID | URL |
| --- | --- | --- |
| `secretaria_form` | `AKfycbzN13M7Lx3PE6QJWszTFWXRYxtjV6wKjSXoso6Qiiy81ie6oWELXjoEeBkN9UxRIoKcZg` | `https://script.google.com/a/macros/iernestlluch.cat/s/AKfycbzN13M7Lx3PE6QJWszTFWXRYxtjV6wKjSXoso6Qiiy81ie6oWELXjoEeBkN9UxRIoKcZg/exec` |
| `students_creator_panel` | `AKfycbzYJNtJmhqx7vNR4pU0GXQrBdCTBmg8Lvtr2JLDYecbNRNDoQYxYhf7UyHcuWerUFNEuA` | `https://script.google.com/a/macros/iernestlluch.cat/s/AKfycbzYJNtJmhqx7vNR4pU0GXQrBdCTBmg8Lvtr2JLDYecbNRNDoQYxYhf7UyHcuWerUFNEuA/exec` |

## Shared Documentation

| Path | Purpose |
| --- | --- |
| `docs/SHARED_SPREADSHEET_DATABASE.md` | Shared spreadsheet registry pattern. |
| `docs/DINANTIA_API_NOTES.md` | Dinantia API overview, endpoints, auth, and security notes. |
| `docs/ACCESS_CONTROL.md` | Shared role-based access-control model used by both web apps. |

## Shared Access Control

Both deployed web apps are restricted to the `iernestlluch.cat` domain in `appsscript.json`, then filtered again on the server with the `access_granted` script property.

`access_granted` is a comma-separated list of direct institutional emails and/or càrrecs. Càrrecs are resolved through:

```text
db -> tables -> Càrrega lectiva -> carrecs / professors
```

Every browser-callable server method repeats the access check. If `access_granted` is missing or empty, the app denies access.

Each script includes `grantRequiredPermissions()` to force Apps Script authorization for `access_granted`, the active user email, and `Càrrega lectiva` role lookup sheets.

## Repository Rules

- Keep one folder per Apps Script project.
- Keep `.clasp.json` files local and uncommitted.
- Store secrets only in Apps Script script properties.
- Configure access with the `access_granted` script property in each deployed Apps Script project.
- Resolve spreadsheet tables through the shared `db -> tables` registry.
