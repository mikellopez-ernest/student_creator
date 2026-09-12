# Apps Script Access Control

Both Apps Script web apps use the same two-layer access model.

## Layer 1: Apps Script Domain Restriction

Each `appsscript.json` contains:

```json
"webapp": {
  "access": "DOMAIN",
  "executeAs": "USER_DEPLOYING"
}
```

This means the deployed `/exec` URL is only reachable by signed-in users from the `iernestlluch.cat` domain, and the script runs with the deploying user's permissions.

## Layer 2: Server-Side Allow-List

Domain access is not enough. The server code also reads this script property:

```text
access_granted
```

Its value is a comma-separated list of allowed direct institutional emails and/or càrrecs.

Example:

```text
Coord. 3ESO,COCOBE,mikellopez@iernestlluch.cat
```

Entries containing `@` are treated as direct emails. Entries without `@` are treated as càrrecs.

## Role Resolution

Càrrecs are resolved through the shared spreadsheet registry:

```text
script property db
-> registry spreadsheet
-> tables sheet
-> logical table Càrrega lectiva
-> carrecs / professors tabs
```

The access helper reads:

| Source | Column | Meaning |
| --- | --- | --- |
| `Càrrega lectiva -> carrecs` | A | Càrrec name. Must match non-email entries in `access_granted`. |
| `Càrrega lectiva -> carrecs` | D | Assigned person or comma-separated people. |
| `Càrrega lectiva -> professors` | Q | Full teacher name, used as lookup key. |
| `Càrrega lectiva -> professors` | L | Institutional email. |

Matching for càrrec names and teacher names ignores accents and case.

## Protected Entry Points

Both apps protect `doGet()` and browser-callable server methods.

`secretaria_form`:

- `doGet()`
- `submitNewStudentForm(payload)`

`students_creator_panel`:

- `doGet()`
- `getPanelData()`
- `checkGoogleEmailAvailability(email)`
- `createStudentAccounts(request)`

If access is denied during `doGet()`, the app renders an `Acces no autoritzat` page. If access is denied during a server method, the method throws an error to the browser.

## Required Script Properties

Every protected script must have:

| Property | Meaning |
| --- | --- |
| `db` | Spreadsheet ID of the shared registry containing the `tables` tab. |
| `access_granted` | Comma-separated allow-list of direct emails and/or càrrecs. |

If `access_granted` is missing or empty, the app denies access.

## Permission Helper

Each script includes `grantRequiredPermissions()`. Run it manually from Apps Script if the deploying user needs to authorize the required reads.

The helper touches:

- `db`
- `access_granted`
- active user email
- `Càrrega lectiva -> carrecs`
- `Càrrega lectiva -> professors`

## Files

The shared implementation is copied into each Apps Script project:

| Script | File |
| --- | --- |
| `secretaria_form` | `secretaria_form/src/AccessControl.js` |
| `students_creator_panel` | `students_creator_panel/src/AccessControl.js` |

Keep the two copies aligned when changing access behavior.
