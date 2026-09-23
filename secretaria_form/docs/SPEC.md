# secretaria_form Specification

## Purpose

`secretaria_form` is the public internal Google Apps Script web app used by `@iernestlluch.cat` users to submit a new student creation request.

The script does not create Google Workspace or Dinantia accounts. It only:

1. Presents the new-student form.
2. Validates submitted student and contact data.
3. Writes the request to the shared spreadsheet database.
4. Sends a notification email to the directive team.

The downstream account creation workflow is handled by `students_creator_panel`.

## Deployment

| Field | Value |
| --- | --- |
| Apps Script project | `secretaria_form` |
| Script ID | `1KpY9TUEFi3evt-1NmVQLAVcAw-rbiDlyEYnRQTc_HrSq3wEXuN5RI2wg` |
| Deployment ID | `AKfycbzN13M7Lx3PE6QJWszTFWXRYxtjV6wKjSXoso6Qiiy81ie6oWELXjoEeBkN9UxRIoKcZg` |
| Web app URL | `https://script.google.com/a/macros/iernestlluch.cat/s/AKfycbzN13M7Lx3PE6QJWszTFWXRYxtjV6wKjSXoso6Qiiy81ie6oWELXjoEeBkN9UxRIoKcZg/exec` |
| Execute as | Deploying user |
| Access | Domain users, then server-side filtered by `access_granted` |

Future deployments must redeploy this existing deployment ID so the URL remains stable.

## Script Properties

Required Apps Script script properties:

| Property | Meaning |
| --- | --- |
| `db` | Spreadsheet ID of the shared database registry. |
| `access_granted` | Comma-separated allowed direct emails and/or càrrecs from `Càrrega lectiva -> carrecs`. |
| `dinantia_api_user` | Present in the project, but not used by this public form flow. |
| `dinantia_api_secret` | Present in the project, but not used by this public form flow. |

Secrets must not be logged, committed, or displayed in generated output.

## Shared Database Pattern

All spreadsheet access must resolve through the registry chain:

```text
script property db
-> registry spreadsheet
-> tables sheet
-> logical table Dinantia
-> registered spreadsheet ID
-> requested sheet tab
```

The script must never hardcode spreadsheet IDs for the logical tables.

## Source Tables

### `Dinantia -> new_student_config`

Used to populate the `Nivell` dropdown.

| Header | Required | Meaning |
| --- | --- | --- |
| `courses` | Yes | Course/level option displayed in the form. |
| `email_coord` | No for this script | Used later by `students_creator_panel`. |
| `email_digi` | No for this script | Used later by `students_creator_panel`. |

The public form only requires `courses`.

## Destination Tables

### `Dinantia -> new_student_form`

One row is appended per submitted student.

| Header | Required | Source |
| --- | --- | --- |
| `id` | Yes | `Identificador de l'alumne` |
| `name` | Yes | `Nom` |
| `surname1` | Yes | `Cognom 1` |
| `surname2` | Yes as a sheet header, optional value | `Cognom 2` |
| `level` | Yes | `Nivell` selected from `new_student_config.courses` |
| `comment` | Yes as a sheet header, optional value | `Comentaris` |
| `managed` | No write on submit | Left empty/null until the admin panel completes processing. |

### `Dinantia -> new_student_form_contacts`

One row is appended per relative/contact block.

| Header | Required | Source |
| --- | --- | --- |
| `id` | Yes | Student identifier, used to link contact rows to the student row. |
| `full_name` | Yes | `Nom complet` |
| `email` | Yes | `Correu electrònic` |
| `phone` | Yes | `Telèfon`, normalized to Dinantia-compatible `+34` format. |
| `relation` | Yes | `Mare`, `Pare`, or `Un altre` |

Phone cells are written as plain text so Google Sheets preserves the leading `+`.

## Web App UI

`doGet()` renders `NewStudentForm.html`.

The page title is:

```text
Creació d'alumne nou.
```

The student block is a vertical one-column form with these fields:

| Label | Type | Required |
| --- | --- | --- |
| `Identificador de l'alumne` | Text input | Yes |
| `Nom` | Text input | Yes |
| `Cognom 1` | Text input | Yes |
| `Cognom 2` | Text input | No |
| `Nivell` | Dropdown from `new_student_config.courses` | Yes |

The mandatory marker `*` appears inline next to the field label.

The form also includes an optional `Comentaris` textarea after the relatives section and before the submit button.

Below the student block, the UI shows:

```text
Afegir un familiar
```

with a `+` button. Each click adds a relative/contact block.

Each contact block contains:

| Label | Type | Required |
| --- | --- | --- |
| `Nom complet` | Text input | Yes |
| `Correu electrònic` | Email input | Yes |
| `Telèfon` | Telephone input | Yes |
| `Relació` | Dropdown | Yes |

Allowed relation values:

- `Mare`
- `Pare`
- `Un altre`

## Access Control

Every entry point uses the shared access-control helpers in `AccessControl.js`.

Access is allowed only when:

1. The deployed web app receives a signed-in domain user.
2. `Session.getActiveUser().getEmail()` returns an email.
3. The email appears directly in `access_granted`, or belongs to a person assigned to one of the allowed càrrecs.

Role resolution:

1. Non-email entries in `access_granted` match `Càrrega lectiva -> carrecs` column A.
2. Assigned people are read from `carrecs` column D.
3. Institutional emails are resolved by matching those names against `Càrrega lectiva -> professors` column Q and reading column L.

The same check runs in:

- `doGet()`
- `submitNewStudentForm(payload)`

Denied access behavior:

- `doGet()` renders an `Acces no autoritzat` page.
- `submitNewStudentForm(payload)` throws a server error returned to the browser.

`grantRequiredPermissions()` touches the script properties, active user email, and the `Càrrega lectiva` lookup sheets so the deploying user can authorize the required scopes.

## Validation

Validation runs in the browser and again on the server.

Student validation:

- `id` is required.
- `name` is required.
- `surname1` is required.
- `level` is required.
- `level` must match a configured `courses` value from `Dinantia -> new_student_config`.

Contact validation:

- `fullName` is required.
- `email` is required and must have a basic email shape.
- `phone` is required and must normalize to a Spanish `+34` phone accepted by the current rules.
- `relation` is required and must be `Mare`, `Pare`, or `Un altre`.

Phone normalization:

| Input | Result |
| --- | --- |
| `666221996` | `+34666221996` |
| `+34666221996` | `+34666221996` |
| `333443333` | Rejected |
| `+34333443333` | Rejected |

Accepted Spanish local numbers must have 9 digits and start with `6`, `7`, `8`, or `9`.

## Submission Flow

When the browser submits the form:

1. Browser validates required fields, email shape, and phone format.
2. Browser calls `submitNewStudentForm(payload)`.
3. Server repeats access control.
4. Server reads configured courses from `Dinantia -> new_student_config`.
5. Server validates and sanitizes student data.
6. Server validates and sanitizes contact data.
7. Server verifies that the selected level exists in config.
8. Server opens the `Dinantia` logical table spreadsheet through the registry.
9. Server appends one row to `new_student_form`.
10. Server appends contact rows to `new_student_form_contacts`.
11. Server sends a notification email.
12. Browser displays success and clears the form.

## Email Notification

After saving, the script sends one email to:

```text
equip_directiu@iernestlluch.cat
```

Subject:

```text
Nou alumne pendent de crear: {name} {surname1}
```

Body includes:

- Student identifier
- Name
- First surname
- Second surname, or `-`
- Level
- Comments, or `-`
- Every contact full name, email, phone, and relation

The form no longer sends directly to course coordinators. Course-specific notifications are sent later by `students_creator_panel` after the accounts are created.

## OAuth Scopes

The manifest declares:

| Scope | Reason |
| --- | --- |
| `script.container.ui` | Spreadsheet UI menu helper in `Code.js`. |
| `script.send_mail` | Send directive-team notification. |
| `spreadsheets` | Read config and append rows to shared database sheets. |
| `userinfo.email` | Read active user email for role-based access control. |

## Files

| File | Responsibility |
| --- | --- |
| `src/WebApp.js` | Web app entry points, validation, database writes, notification email. |
| `src/AccessControl.js` | Shared role/email access decision, no-access page, and permission helper. |
| `src/NewStudentForm.html` | Browser form UI and client-side validation. |
| `src/Database.js` | Shared spreadsheet registry helpers and header-based append helper. |
| `src/DinantiaClient.js` | Dinantia auth/header helpers; currently not used by this public flow. |
| `src/Code.js` | Spreadsheet menu helper for checking required configuration. |
| `src/appsscript.json` | Manifest, OAuth scopes, web app deployment settings. |

## Error Handling

User-facing errors are intentionally clear and specific:

- Missing script property `db`
- Missing registry sheet `tables`
- Missing expected sheet headers
- Invalid selected level
- Invalid contact email
- Invalid contact phone
- Invalid relation

The script must not log or display Dinantia credentials.

## Open Decisions

- Whether the public form should require at least one relative/contact. The current implementation allows zero contacts, although each added contact block must be complete.
- Whether `dinantia_api_user` and `dinantia_api_secret` should remain configured in this script if it does not call Dinantia directly.
