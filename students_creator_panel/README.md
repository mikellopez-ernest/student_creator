# students_creator_panel

Google Apps Script admin panel for managing new student submissions.

| Field | Value |
| --- | --- |
| Apps Script project | `students_creator_panel` |
| Script ID | `15OSrsv2yUhKwO_CDV4PzdWCWUo6BE-Y4pNyIyFx9MqRMeBfNmZehRowl` |
| clasp root | `src/` |

## Purpose

The web app reads pending rows from:

| Logical table notation | Data |
| --- | --- |
| `Dinantia -> new_student_form` | Student rows. Uses `managed` to hide completed rows. |
| `Dinantia -> new_student_form_contacts` | Relative/contact rows linked by student `id`. |
| `Dinantia -> new_student_config` | Routing config by course: `courses`, `email_coord`, `email_digi`. |

Rows are shown while `managed` is not `TRUE`. After the full creation process succeeds, or when the user clicks `Arxivar`, the panel writes `TRUE` to `managed`.

## Behavior

The panel shows:

| Column | Behavior |
| --- | --- |
| `Dades de l'alumne` | Full name, level, comment, and every saved relative/contact. |
| `Usuari iernestlluch` | Proposed editable `@iernestlluch.cat` email, prefix match search by `nom+cognom1`, and `Generar només correu`. |
| `Usuari Dinantia` | Dinantia ID availability check, group autocomplete using groups fetched when the page loads, and `Generar només usuari dinantia`. |
| `Generar` | Creates both users and marks the source row as managed. Also includes `Arxivar`, which only sets `managed` to `TRUE`. |

Google Workspace users are created in `/Alumnes` with the initial password `institut` and `changePasswordAtNextLogin: true`.

After the Google Workspace user and Dinantia user are created, the panel sends a summary email to:

- `equip_directiu@iernestlluch.cat`
- The selected course's `email_coord`
- The selected course's `email_digi`

The summary email includes the generated institutional address and the initial password `institut`.

Only after that email is sent does the full `Generar` flow mark `managed` as `TRUE`. The partial buttons do not mark the row as managed; use `Arxivar` when the row should disappear after manual or partial handling.

Contact phone numbers are normalized and validated again before Dinantia creation, so older pending rows still send valid `+34` format to the API.

## Debugging

The `Generar` flow writes structured logs to Apps Script executions with stages such as:

- `createStudentAccounts:start`
- `createStudentAccounts:contextLoaded`
- `createStudentAccounts:validated`
- `createStudentAccounts:googleUserCreated`
- `createStudentAccounts:dinantiaUserCreated`
- `createStudentAccounts:notificationSent`
- `createStudentAccounts:managedSet`
- `createStudentAccounts:failed`

Logs include safe operational metadata only, such as row number, student id, selected group ids, counts, and status codes. They do not include Dinantia credentials or authorization headers.

## Access Control

The web app is domain-restricted and also checks `access_granted` on the server. That property can contain:

- Direct institutional emails.
- Càrrecs from `Càrrega lectiva -> carrecs`, resolved through `Càrrega lectiva -> professors`.

Protected server entry points are `doGet()`, `getPanelData()`, `checkGoogleEmailAvailability(email)`, `checkGoogleEmailPrefixMatches(prefix)`, `checkDinantiaIdAvailability(id)`, and `createStudentAccounts(request)`.
The partial and archive actions are also protected: `createGoogleStudentAccountOnly(request)`, `createDinantiaStudentAccountOnly(request)`, and `archiveStudentRequest(request)`.

If access is denied while opening the panel, the user sees an `Acces no autoritzat` page. If access is denied during a browser action, the server method returns an error to the panel.

## Script Properties

Required:

| Property | Meaning |
| --- | --- |
| `db` | Spreadsheet ID of the shared database registry |
| `access_granted` | Comma-separated allowed direct emails and/or càrrecs from `Càrrega lectiva -> carrecs` |
| `dinantia_api_user` | Dinantia API user |
| `dinantia_api_secret` | Dinantia API secret |

Optional:

| Property | Meaning |
| --- | --- |
| `dinantia_api_base_url` | Dinantia API base URL. Defaults to `https://app.dinantia.com/api/web`. |

## Deployment

Deployment settings are defined in `src/appsscript.json`:

| Setting | Value |
| --- | --- |
| Execute as | Deploying user |
| Who has access | Domain users, then server-side filtered by `access_granted` |

Keep redeploying the existing deployment ID after the first web app deployment so the URL remains stable.

Current web app deployment:

| Field | Value |
| --- | --- |
| Deployment ID | `AKfycbzYJNtJmhqx7vNR4pU0GXQrBdCTBmg8Lvtr2JLDYecbNRNDoQYxYhf7UyHcuWerUFNEuA` |
| URL | `https://script.google.com/a/macros/iernestlluch.cat/s/AKfycbzYJNtJmhqx7vNR4pU0GXQrBdCTBmg8Lvtr2JLDYecbNRNDoQYxYhf7UyHcuWerUFNEuA/exec` |

## Commands

Run these from `students_creator_panel/`:

```sh
npm install
npm run status
npm run pull
npm run push
npm run open
```

## Local Documentation

- `docs/SPEC.md`
- `docs/DEPLOYMENT.md`
- `docs/DINANTIA_STUDENT_CREATION.md`
- `../docs/ACCESS_CONTROL.md`
- `../docs/SHARED_SPREADSHEET_DATABASE.md`
- `../docs/DINANTIA_API_NOTES.md`
