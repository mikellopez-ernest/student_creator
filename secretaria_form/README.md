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
| Who has access | Any `iernestlluch.cat` user |

Current web app deployment:

| Field | Value |
| --- | --- |
| Deployment ID | `AKfycbzN13M7Lx3PE6QJWszTFWXRYxtjV6wKjSXoso6Qiiy81ie6oWELXjoEeBkN9UxRIoKcZg` |
| URL | `https://script.google.com/a/macros/iernestlluch.cat/s/AKfycbzN13M7Lx3PE6QJWszTFWXRYxtjV6wKjSXoso6Qiiy81ie6oWELXjoEeBkN9UxRIoKcZg/exec` |

The web app stores submissions in:

| Logical table notation | Data |
| --- | --- |
| `Dinantia -> new_student_form` | Student row with `id`, `name`, `surname1`, `surname2`, and `level` |
| `Dinantia -> new_student_form_contacts` | Relative/contact rows linked by student `id` |
| `Dinantia -> new_student_config` | Course dropdown options |

After saving, the web app sends an email notification to:

- `equip_directiu@iernestlluch.cat`

Relative phone numbers are normalized before saving:

- `666221996` is saved as `+34666221996`
- `+34666221996` is accepted unchanged
- Other formats, including Spanish numbers that do not start with `6`, `7`, `8`, or `9`, are rejected

Phone cells are written as plain text so Google Sheets keeps the leading `+`.

## Shared References

- `../docs/SHARED_SPREADSHEET_DATABASE.md`
- `../docs/DINANTIA_API_NOTES.md`

## Local Documentation

- `docs/SPEC.md`
- `docs/DEPLOYMENT.md`
