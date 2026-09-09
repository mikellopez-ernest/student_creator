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

Rows are shown while `managed` is not `TRUE`. After the full creation process succeeds, the panel writes `TRUE` to `managed`.

## Behavior

The panel shows:

| Column | Behavior |
| --- | --- |
| `Dades de l'alumne` | Full name, level, and every saved relative/contact. |
| `Usuari iernestlluch` | Proposed editable `@iernestlluch.cat` email and availability check. |
| `Usuari Dinantia` | Dinantia group autocomplete using groups fetched when the page loads. |
| `Generar` | Creates the Google Workspace user and the Dinantia user, then marks the source row as managed. |

Google Workspace users are created in `/Alumnes` with the initial password `institut` and `changePasswordAtNextLogin: true`.

After the Google Workspace user and Dinantia user are created, the panel sends a summary email to:

- `equip_directiu@iernestlluch.cat`
- The selected course's `email_coord`
- The selected course's `email_digi`

The summary email includes the generated institutional address and the initial password `institut`.

Only after that email is sent does the panel mark `managed` as `TRUE`.

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

The web app is server-side protected. Access is allowed for signed-in users who are either:

- In Google Workspace OU `/Administradors`
- Google Workspace admins
- Google Workspace delegated admins

Every server-side action repeats the admin check.

## Script Properties

Required:

| Property | Meaning |
| --- | --- |
| `db` | Spreadsheet ID of the shared database registry |
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
| Who has access | Domain users |

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
