# secretaria_form

Internal Google Apps Script student-management web app managed with clasp.

| Field | Value |
| --- | --- |
| Apps Script project | `secretaria_form` |
| Script ID | `1KpY9TUEFi3evt-1NmVQLAVcAw-rbiDlyEYnRQTc_HrSq3wEXuN5RI2wg` |
| clasp root | `src/` |

## Setup

Install dependencies from this folder:

```sh
npm install
```

Log in to clasp:

```sh
npm run login
```

The local `.clasp.json` already points at `secretaria_form`. If it needs to be recreated:

```sh
cp .clasp.example.json .clasp.json
```

Then replace the placeholder `scriptId` if needed.

## Script Properties

This Apps Script project already has the required properties configured:

| Property | Meaning |
| --- | --- |
| `db` | Spreadsheet ID of the shared database registry |
| `access_granted` | Comma-separated allowed direct emails and/or càrrecs from `Càrrega lectiva -> carrecs` |
| `dinantia_api_user` | Dinantia API user |
| `dinantia_api_secret` | Dinantia API secret |
| `dinantia_api_base_url` | Optional API base URL; defaults to `https://app.dinantia.com/api/web` |

Do not commit, log, or display secret values.

## Commands

Run these from `secretaria_form/`:

```sh
npm run status
npm run pull
npm run push
npm run open
```

## Web App

The script exposes a web app through `doGet()`.

Deployment settings should be:

| Setting | Value |
| --- | --- |
| Execute as | `admindomini@iernestlluch.cat` |
| Who has access | Domain users, then server-side filtered by `access_granted` |

Current web app deployment:

| Field | Value |
| --- | --- |
| Deployment ID | `AKfycbzN13M7Lx3PE6QJWszTFWXRYxtjV6wKjSXoso6Qiiy81ie6oWELXjoEeBkN9UxRIoKcZg` |
| URL | `https://script.google.com/a/macros/iernestlluch.cat/s/AKfycbzN13M7Lx3PE6QJWszTFWXRYxtjV6wKjSXoso6Qiiy81ie6oWELXjoEeBkN9UxRIoKcZg/exec` |

The root URL presents two operations:

- `Crear alumne nou` opens the existing new-student request form.
- `Baixa d'alumne` selects a cached Dinantia student, deletes the Dinantia account, and marks the permanent student row as withdrawn.

The new-student form stores submissions in:

| Logical table notation | Data |
| --- | --- |
| `Dinantia -> new_student_form` | Student row with `id`, `name`, `surname1`, `surname2`, `level`, and `comment` |
| `Dinantia -> new_student_form_contacts` | Relative/contact rows linked by student `id` |
| `Dinantia -> new_student_config` | Course dropdown options |

After saving, the web app sends an email notification to:

- `equip_directiu@iernestlluch.cat`

Relative phone numbers are normalized before saving:

- `666221996` is saved as `+34666221996`
- `+34666221996` is accepted unchanged
- Other formats, including Spanish numbers that do not start with `6`, `7`, `8`, or `9`, are rejected

Phone cells are written as plain text so Google Sheets keeps the leading `+`.

The withdrawal workflow uses:

| Logical table notation | Data |
| --- | --- |
| `Dinantia -> students_cache` | Available groups and students, including `student_id`, `student_name`, `student_email`, `group_name`, and `student_data_sheet` |
| `Dinantia -> new_student_config` | Course-specific `email_coord` and `email_digi` notification recipients |
| `Dades alumnes` | Permanent student rows; column K is marked `TRUE` and column M receives the withdrawal date |

Before deleting from Dinantia, the server confirms that the cache selection is still valid, the student ID occurs exactly once in the supported `Dades alumnes` sheets, the cache sheet name matches that row, the notification configuration is complete, and the Dinantia account exists. After the Dinantia and permanent-row updates are verified, every `students_cache` row with that `student_id` is deleted, including rows for other groups. The Google Workspace account is not modified.

Completed withdrawal notifications go to:

- `equip_directiu@iernestlluch.cat`
- The course's `email_coord`
- The course's `email_digi`
- `secretaria@iernestlluch.cat`

## Access Control

The web app is domain-restricted and also checks `access_granted` on the server. That property can contain direct institutional emails and/or càrrecs from `Càrrega lectiva -> carrecs`; càrrecs are resolved through `Càrrega lectiva -> professors` to institutional emails.

All browser-callable methods enforce the same check, including the landing page, new-student submission, withdrawal dropdown loaders, and final withdrawal action.

If access is denied while opening the app, the user sees an `Acces no autoritzat` page. If access is denied during submission, the server method returns an error to the form.

## Shared References

- `../docs/SHARED_SPREADSHEET_DATABASE.md`
- `../docs/DINANTIA_API_NOTES.md`
- `../docs/ACCESS_CONTROL.md`

## Local Documentation

- `docs/SPEC.md`
- `docs/DEPLOYMENT.md`
- `docs/STUDENT_WITHDRAWAL.md`
