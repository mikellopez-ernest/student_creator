# Dades alumnes Student Registry Creation

## Purpose

After a new student is created in Dinantia, `students_creator_panel` creates the corresponding permanent row in the logical table `Dades alumnes`, currently `Dades alumnes 2026-2027`.

The integration is used by:

- `Generar`, after both the Google Workspace user and Dinantia account succeed.
- `Generar només usuari Dinantia`, after Dinantia succeeds and only when the institutional Google account already exists.

`Generar només correu` and `Arxivar` do not create a student-registry row.

## Logical Table And Destination Sheets

The spreadsheet is resolved through:

```text
db -> tables -> Dades alumnes
```

Only these sheets can be written:

| Form level | Destination sheet | `CURS` value | Required Dinantia class label |
| --- | --- | --- | --- |
| `1r ESO` | `1r ESO` | `1r ESO` | `1r ESO X` |
| `2n ESO` | `2n ESO` | `2n ESO` | `2n ESO X` |
| `3r ESO` | `3r ESO` | `3r ESO` | `3r ESO X` |
| `4t ESO` | `4t ESO` | `4t ESO` | `4t ESO X` |
| `1r BAT` / `1r Batx` | `1r Batx` | `1r Bat` | `BATX 1r X` |
| `2n BAT` / `2n Batx` | `2n Batx` | `2n Bat` | `BATX 2n X` |
| `1r SMX` | `SMX` | `SMX` | `SMX 1r` |
| `2n SMX` | `SMX` | `SMX` | `SMX 2n` |
| `1r PCC` | `PCC` | `PCC` | `PCC 1r` |
| `2n PCC` | `PCC` | `PCC` | `PCC 2n` |
| `PFI` | `PFI` | `PFI` | `PFI` |
| `1r AC` | `AC` | `AC` | `AC 1r` |
| `2n AC` | `AC` | `AC` | `AC 2n` |

`X` represents the class letter. Unsupported levels, including a standalone `SIEI` value without an ESO course, are rejected before external account creation.

## Preconditions

Before creating external accounts, the panel verifies:

1. The level maps to an allowed destination sheet.
2. Exactly one selected Dinantia group has a class label compatible with that level.
3. The destination sheet has the expected A:AA schema.
4. The student ID does not already exist in any supported destination sheet.

For `Generar només usuari Dinantia`, the institutional Google account must already exist so its real creation date can be used as `Data alta`.

## Written Columns

| Column | Header | Value |
| --- | --- | --- |
| A | `ID` | Student identifier from `new_student_form.id`. |
| B | `Correu alumne` | Institutional email used by the creation flow. |
| C | `Cognoms, Nom` | Formula copied from the preceding valid row, preserving locale syntax and relative references. |
| D | `Cognom1` | First surname. |
| E | `Cognom2` | Second surname or blank. |
| F | `Nom` | Given name. |
| G | `CURS` | Course label from the mapping table above. |
| H | `Classe inicial` | Compatible selected Dinantia class label. |
| I | `Classe definitiva` | Same value as the initial class when the student is created. |
| J | `Nova alta?` | Boolean `TRUE`. |
| K | `Nova baixa?` | Boolean `FALSE`. |
| L | `Data alta` | Google Workspace account creation timestamp; the current creation time is used if the insert response omits it. |
| M | `Data baixa` | Blank. |
| N | `Religió` | Blank for later completion. |
| O | `Acollida` | Blank for later completion. |
| P:U | Optional-subject/reserved columns | Preserved and left blank. |
| V | `Correu tutor1` | First unique contact email. |
| W | `Correu tutor2` | Second unique contact email, if present. |
| X | `Correu no @iernestlluch.cat` | Blank. |
| Y | `BaixaLogica` | Boolean `FALSE`. |
| Z | `Problema alta` | Boolean `FALSE`. |
| AA | `Data Naixement` | Blank for later completion. |

Duplicate contact emails are collapsed before writing V and W.

## Row And Formatting Behavior

The panel finds the last row with an ID in column A and uses the following row. If the sheet has no available row, it inserts one.

The new row receives:

- Formatting copied from the preceding valid row.
- Data validation copied from the preceding valid row.
- The column C formula copied with `PASTE_FORMULA`, so the spreadsheet's native locale syntax is preserved.

After writing, the panel flushes the spreadsheet and verifies ID, institutional email, and the calculated display name. A formula error or mismatched value aborts the flow.

## Ordering And Completion

The full `Generar` sequence is:

1. Validate source data, Google email availability, Dinantia ID availability, groups, and registry preconditions.
2. Save corrected contacts.
3. Create the Google Workspace user.
4. Create the Dinantia student.
5. Create and verify the `Dades alumnes` row.
6. Send the completion notification, including registry sheet, row, and class.
7. Set `new_student_form.managed` to `TRUE`.

The source request is marked as managed only after all seven steps succeed.

## Concurrency And Duplicate Protection

Registry insertion uses a script lock and repeats the duplicate-ID scan while holding that lock. This prevents two panel requests from inserting the same student ID concurrently.

The duplicate check covers all ten allowed destination sheets, not only the expected course sheet.

## Failure Model

- Registry validation failures occur before account creation.
- Registry insertion occurs only after Dinantia succeeds.
- If registry insertion or its post-write verification fails, the request remains unmanaged and an error is shown.
- External systems and Google Sheets do not provide a shared transaction. If Google and Dinantia succeed but the registry write fails, those external accounts are not automatically deleted.
- Unknown fields such as birthdate, religion, reception status, and optional subjects remain blank for later completion.
