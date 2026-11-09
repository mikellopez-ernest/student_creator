# Student Withdrawal Workflow

## Purpose

The `Baixa d'alumne` flow removes an existing student account from Dinantia, marks the matching permanent record as a new withdrawal in `Dades alumnes`, removes all cached rows for the student, and notifies the responsible teams.

It does not delete, suspend, or otherwise modify the student's Google Workspace account. After the external account and permanent row are updated, it deletes the student from `Dinantia -> students_cache`.

## User Interface

The web app root shows two choices:

1. `Crear alumne nou`
2. `Baixa d'alumne`

The withdrawal page loads a `Selecciona el grup` dropdown from distinct, non-empty `students_cache.group_name` values. After the user selects a group, the `Alumnes` dropdown loads the distinct cached students belonging to that exact group.

Student options display:

```text
{student_name} ({student_id})
```

Selecting a student opens a modal confirmation with explicit `Sí` and `No` buttons. The modal explains that the action will:

- Delete the student from Dinantia.
- Mark the student as withdrawn in `Dades alumnes`.
- Delete the student from the local cache.
- Send a withdrawal notification.

`No` closes the modal and clears the student selection. `Sí` starts the server-side workflow.

## Source: `Dinantia -> students_cache`

Expected headers:

| Header | Used | Meaning |
| --- | --- | --- |
| `student_id` | Yes | Dinantia account ID and permanent student ID. |
| `student_name` | Yes | Display name used in the dropdown and email. |
| `student_email` | Yes | Institutional email included in the notification. |
| `group_name` | Yes | Group dropdown and server-side selection validation. |
| `student_data_sheet` | Yes | Expected destination sheet in `Dades alumnes`. |
| `parent_ids` | No | Cache-only data. |
| `birthdate` | No | Cache-only data. |
| `birthdate_sort_key` | No | Cache-only data. |
| `age` | No | Cache-only data. |
| `document` | No | Cache-only data. |
| `study_type` | No | Cache-only data. |
| `is_adult` | No | Cache-only data. |
| `is_14_plus` | No | Cache-only data. |
| `photo_url` | No | Cache-only data. |

The final server call receives only `groupName` and `studentId`. It reloads the cache and verifies that the selected ID still belongs to the selected group. Browser-supplied names, emails, levels, sheet names, and recipients are never trusted.

If duplicate cache rows exist for the same group and student, their name, email, and `student_data_sheet` values must agree. Contradictory rows stop the workflow.

On successful withdrawal, every row with the selected `student_id` is deleted from `students_cache`, including rows for groups other than the one selected in the UI. Deletions run in descending row order so earlier row numbers do not shift before they are processed. The script then rescans the `student_id` column and fails visibly if any matching row remains.

## Permanent Student Registry

The logical table name is exactly:

```text
Dades alumnes
```

Supported sheets:

- `1r ESO`
- `2n ESO`
- `3r ESO`
- `4t ESO`
- `1r Batx`
- `2n Batx`
- `SMX`
- `PCC`
- `PFI`
- `AC`

The workflow scans column A of every supported sheet for `student_id` and requires exactly one match. It also requires the matched sheet to agree with `students_cache.student_data_sheet`.

Required registry columns:

| Column | Header | Use |
| --- | --- | --- |
| A | `ID` | Unique student lookup. |
| B | `Correu alumne` | Notification detail. |
| C | `Cognoms, Nom` | Notification detail. |
| G | `CURS` | Course routing evidence. |
| H | `Classe inicial` | Course routing evidence. |
| I | `Classe definitiva` | Course routing evidence. |
| K | `Nova baixa?` | Set to boolean `TRUE`. |
| M | `Data baixa` | Set to the current date and time. |

If column K is already true, the workflow stops before calling Dinantia.

## Course and Recipient Resolution

The server derives the course from the cache group, permanent sheet name, `CURS`, and initial/final class. It supports the configured course labels used by the application:

- `1r ESO`, `2n ESO`, `3r ESO`, `4t ESO`
- `SIEI`
- `1r BAT`, `2n BAT` and equivalent Batxillerat labels
- `1r SMX`, `2n SMX`
- `1r PCC`, `2n PCC`
- `PFI`
- `1r AC`, `2n AC`

The matching row in `Dinantia -> new_student_config` must contain valid `email_coord` and `email_digi` addresses.

Recipients are deduplicated and include:

- `equip_directiu@iernestlluch.cat`
- The selected course's `email_coord`
- The selected course's `email_digi`
- `secretaria@iernestlluch.cat`

## Safe Execution Sequence

The final `withdrawStudent(payload)` method acquires a script lock and performs these steps:

1. Recheck application access.
2. Validate the selected group and student ID.
3. Reload `students_cache` and verify the exact selection.
4. Locate exactly one permanent student row across all supported sheets.
5. Verify that `student_data_sheet` matches the located sheet.
6. Validate the permanent-sheet schema and ensure the student is not already marked as withdrawn.
7. Resolve and validate all notification recipients.
8. Confirm that the Dinantia account exists with `GET /v1/accounts/view/{id}`.
9. Delete the account with `DELETE /v1/accounts/delete/{id}`.
10. Set column K to boolean `TRUE` and column M to the current date/time.
11. Flush and verify both spreadsheet changes.
12. Delete all matching `students_cache` rows from bottom to top.
13. Verify that the student ID no longer exists in the cache.
14. Send the notification email with the number of removed cache rows.

All checks that can fail safely occur before the destructive API call.

## Failure Model

Dinantia, Google Sheets, and email do not provide a shared transaction.

- A validation, cache, recipient, registry, or Dinantia preflight error makes no changes.
- If Dinantia deletion succeeds but the spreadsheet write or verification fails, the error explicitly identifies the permanent sheet and row for manual repair.
- If Dinantia deletion and the permanent-sheet update succeed but cache deletion fails, those completed changes cannot be rolled back automatically. The error tells the operator to repair the cache manually.
- If deletion and spreadsheet updates succeed but email delivery fails, those completed changes cannot be rolled back automatically. The Apps Script execution log records the workflow stages for diagnosis.

The user must not repeat an uncertain operation without first checking Dinantia, `Dades alumnes`, and `students_cache`. Because cache rows are removed before email is sent, an email failure requires manual notification rather than a retry through the withdrawal page.

## Dinantia API

Authentication uses the existing `dinantia_api_user` and `dinantia_api_secret` script properties with HTTP Basic authentication. The optional `dinantia_api_base_url` property overrides the default:

```text
https://app.dinantia.com/api/web
```

Used endpoints:

```text
GET /v1/accounts/view/{id}
DELETE /v1/accounts/delete/{id}
```
