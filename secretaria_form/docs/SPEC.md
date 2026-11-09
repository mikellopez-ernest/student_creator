# secretaria_form Specification

## Purpose

`secretaria_form` is the internal Google Apps Script web app used by authorized `@iernestlluch.cat` users to submit new-student requests and process student withdrawals.

The root page presents two operations:

1. `Crear alumne nou` validates and stores a pending creation request, then notifies the directive team.
2. `Baixa d'alumne` deletes an existing Dinantia account, marks the unique permanent student row as withdrawn, and sends course-aware notifications.

The downstream new-account creation workflow remains handled by `students_creator_panel`. The withdrawal flow never modifies the student's Google Workspace account.

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
| `dinantia_api_user` | Dinantia API username used by the withdrawal flow. |
| `dinantia_api_secret` | Dinantia API secret used by the withdrawal flow. |
| `dinantia_api_base_url` | Optional Dinantia API base URL; defaults to `https://app.dinantia.com/api/web`. |

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

The script must never hardcode spreadsheet IDs for the logical tables. It resolves both `Dinantia` and `Dades alumnes` through the same registry.

## Source Tables

### `Dinantia -> new_student_config`

Used to populate the `Nivell` dropdown.

| Header | Required | Meaning |
| --- | --- | --- |
| `courses` | Yes | Course/level option displayed in the form. |
| `email_coord` | Required for withdrawal | Course coordinator recipient. |
| `email_digi` | Required for withdrawal | Digital coordinator recipient. |

The new-student form only requires `courses`; the withdrawal flow also requires valid `email_coord` and `email_digi` values for the resolved course.

### `Dinantia -> students_cache`

Withdrawal selection source and final cleanup table. Required headers are `student_id`, `student_name`, `student_email`, `group_name`, and `student_data_sheet`. The remaining cache columns are not used by this flow.

The group dropdown uses distinct `group_name` values. Student options are deduplicated by `student_id` within the selected group. Duplicate rows for the same selection must agree on student name, email, and permanent sheet.

After Dinantia deletion and the permanent-row update are verified, the script deletes every cache row whose `student_id` matches the withdrawn student. Rows are deleted from bottom to top and the column is rescanned to verify that no matching ID remains.

### `Dades alumnes`

The withdrawal flow scans the supported permanent sheets and requires exactly one column-A match for the selected `student_id`. The matched sheet must equal `students_cache.student_data_sheet`.

It writes:

| Column | Header | Withdrawal value |
| --- | --- | --- |
| K | `Nova baixa?` | Boolean `TRUE` |
| M | `Data baixa` | Current date and time |

Supported sheets are `1r ESO`, `2n ESO`, `3r ESO`, `4t ESO`, `1r Batx`, `2n Batx`, `SMX`, `PCC`, `PFI`, and `AC`.

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

`doGet()` reads the optional `view` query parameter:

| Route | Template | Purpose |
| --- | --- | --- |
| Root | `LandingPage.html` | Shows `Crear alumne nou` and `Baixa d'alumne`. |
| `?view=new-student` | `NewStudentForm.html` | Existing creation-request form. |
| `?view=withdrawal` | `WithdrawalPage.html` | Group/student selectors and confirmation dialog. |

The new-student page title is:

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

### Withdrawal UI

The withdrawal page first loads distinct cache groups into `Selecciona el grup`. Selecting a group calls `getWithdrawalStudents(groupName)` and enables the `Alumnes` dropdown.

Selecting a student opens a modal that lists the effects of the operation and asks `Segur que vol continuar?`. It states that the student will be deleted from Dinantia and the cache, marked as withdrawn in `Dades alumnes`, and notified. The modal uses explicit `Sí` and `No` buttons. `No` clears the selection. `Sí` calls `withdrawStudent({groupName, studentId})`.

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
- `getWithdrawalGroups()`
- `getWithdrawalStudents(groupName)`
- `withdrawStudent(payload)`

Denied access behavior:

- `doGet()` renders an `Acces no autoritzat` page.
- `submitNewStudentForm(payload)` throws a server error returned to the browser.
- Withdrawal loaders and actions throw server errors returned to the withdrawal page.

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

## Withdrawal Flow

The final withdrawal action uses a script lock to prevent overlapping submissions and follows this order:

1. Recheck application access and sanitize `groupName` and `studentId`.
2. Reload `Dinantia -> students_cache`; verify the ID still belongs to the selected group and its identity fields agree.
3. Scan column A of every supported `Dades alumnes` sheet.
4. Require exactly one student-ID match and require its sheet name to match `student_data_sheet`.
5. Validate the permanent-sheet headers and verify column K is not already true.
6. Resolve the course from cache and permanent-row evidence.
7. Load and validate `email_coord` and `email_digi` from `new_student_config`.
8. Confirm the Dinantia account exists with `GET /v1/accounts/view/{id}`.
9. Delete it with `DELETE /v1/accounts/delete/{id}`.
10. Set permanent column K to boolean `TRUE` and column M to the current date/time.
11. Flush and verify both spreadsheet values.
12. Delete every `students_cache` row with the withdrawn `student_id`, in descending row order.
13. Rescan `student_id` and require that no matching row remains.
14. Send the withdrawal notification, including the number of cache rows removed.

The preflight completes every safe validation before the destructive API call. The Google Workspace account is not modified.

See `docs/STUDENT_WITHDRAWAL.md` for the complete schema, routing, safety, and failure specification.

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

### Withdrawal Notification

After Dinantia deletion and permanent-row verification, the script sends one deduplicated email to:

- `equip_directiu@iernestlluch.cat`
- `email_coord` for the resolved course
- `email_digi` for the resolved course
- `secretaria@iernestlluch.cat`

The body includes the student name, ID, institutional email, selected group, resolved course, permanent sheet and row, withdrawal date, requesting user, and completed actions.
It also reports how many `students_cache` rows were deleted.

## OAuth Scopes

The manifest declares:

| Scope | Reason |
| --- | --- |
| `script.container.ui` | Spreadsheet UI menu helper in `Code.js`. |
| `script.send_mail` | Send directive-team notification. |
| `script.external_request` | Read and delete Dinantia accounts through its API. |
| `spreadsheets` | Read config and append rows to shared database sheets. |
| `userinfo.email` | Read active user email for role-based access control. |

## Files

| File | Responsibility |
| --- | --- |
| `src/WebApp.js` | Route selection, new-student validation, request writes, and creation-request email. |
| `src/AccessControl.js` | Shared role/email access decision, no-access page, and permission helper. |
| `src/LandingPage.html` | Root operation selector. |
| `src/NewStudentForm.html` | Browser form UI and client-side validation. |
| `src/WithdrawalPage.html` | Withdrawal selectors, confirmation modal, and result handling. |
| `src/StudentWithdrawal.js` | Cache reads, permanent-row preflight/update, course routing, deletion orchestration, and withdrawal email. |
| `src/Database.js` | Shared spreadsheet registry helpers and header-based append helper. |
| `src/DinantiaClient.js` | Authenticated Dinantia request, account lookup, and account deletion helpers. |
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
- Missing or contradictory withdrawal cache data
- Missing, duplicate, or mismatched permanent student rows
- Already-withdrawn permanent rows
- Missing or invalid course notification recipients
- Missing Dinantia accounts or API deletion failures
- Permanent-row post-write verification failures
- Cache-row deletion or post-delete verification failures
- Notification failure after the destructive steps have completed

The script must not log or display Dinantia credentials.

## Open Decisions

- Whether the new-student form should require at least one relative/contact. The current implementation allows zero contacts, although each added contact block must be complete.
