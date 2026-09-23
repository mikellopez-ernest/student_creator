# secretaria_form

Google Apps Script project managed with clasp.

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

The web app stores submissions in:

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

## Access Control

The web app is domain-restricted and also checks `access_granted` on the server. That property can contain direct institutional emails and/or càrrecs from `Càrrega lectiva -> carrecs`; càrrecs are resolved through `Càrrega lectiva -> professors` to institutional emails.

Both `doGet()` and `submitNewStudentForm(payload)` enforce the same check.

If access is denied while opening the app, the user sees an `Acces no autoritzat` page. If access is denied during submission, the server method returns an error to the form.

## Shared References

- `../docs/SHARED_SPREADSHEET_DATABASE.md`
- `../docs/DINANTIA_API_NOTES.md`
- `../docs/ACCESS_CONTROL.md`

## Local Documentation

- `docs/SPEC.md`
- `docs/DEPLOYMENT.md`
