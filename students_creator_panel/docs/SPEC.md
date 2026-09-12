# students_creator_panel Specification

## Purpose

`students_creator_panel` is the protected admin Google Apps Script web app used to process pending new-student requests submitted through `secretaria_form`.

The panel reads the shared database tables, lets an authorized admin review and correct contact data, creates the Google Workspace student user, creates the Dinantia student account, sends a completion notification, and marks the source row as managed.

## Deployment

| Field | Value |
| --- | --- |
| Apps Script project | `students_creator_panel` |
| Script ID | `15OSrsv2yUhKwO_CDV4PzdWCWUo6BE-Y4pNyIyFx9MqRMeBfNmZehRowl` |
| Deployment ID | `AKfycbzYJNtJmhqx7vNR4pU0GXQrBdCTBmg8Lvtr2JLDYecbNRNDoQYxYhf7UyHcuWerUFNEuA` |
| Web app URL | `https://script.google.com/a/macros/iernestlluch.cat/s/AKfycbzYJNtJmhqx7vNR4pU0GXQrBdCTBmg8Lvtr2JLDYecbNRNDoQYxYhf7UyHcuWerUFNEuA/exec` |
| Execute as | Deploying user |
| Access | Domain users, then server-side filtered by `access_granted` |

Future deployments must redeploy this existing deployment ID so the URL remains stable.

## Script Properties

Required Apps Script script properties:

| Property | Meaning |
| --- | --- |
| `db` | Spreadsheet ID of the shared database registry. |
| `access_granted` | Comma-separated allowed direct emails and/or càrrecs from `Càrrega lectiva -> carrecs`. |
| `dinantia_api_user` | Dinantia API user. |
| `dinantia_api_secret` | Dinantia API secret. |

Optional:

| Property | Meaning |
| --- | --- |
| `dinantia_api_base_url` | Dinantia API base URL. Defaults to `https://app.dinantia.com/api/web`. |

Secrets must not be logged, committed, or displayed.

## Shared Database Pattern

All spreadsheet access must resolve through:

```text
script property db
-> registry spreadsheet
-> tables sheet
-> logical table Dinantia
-> registered spreadsheet ID
-> requested sheet tab
```

The script must not hardcode spreadsheet IDs for these logical tables.

## Database Tables

### `Dinantia -> new_student_form`

Source table for submitted student rows.

| Header | Required | Meaning |
| --- | --- | --- |
| `id` | Yes | Student identifier. Also used as Dinantia account ID. |
| `name` | Yes | Student given name. |
| `surname1` | Yes | First surname. |
| `surname2` | Yes as a header, optional value | Second surname. |
| `level` | Yes | Selected course/level. Must match `new_student_config.courses`. |
| `managed` | Yes | Processing flag. Rows are displayed while this is not boolean/string `TRUE`. |

When all processing succeeds, `managed` is set to `TRUE`.

### `Dinantia -> new_student_form_contacts`

Contacts/relatives linked to students by `id`.

| Header | Required | Meaning |
| --- | --- | --- |
| `id` | Yes | Student identifier linking the contact to `new_student_form.id`. |
| `full_name` | Yes | Contact full name. Editable in the panel. |
| `email` | Yes | Contact email. Editable in the panel. |
| `phone` | Yes | Contact phone. Editable in the panel and normalized before Dinantia creation. |
| `relation` | Yes | Contact relation: `Mare`, `Pare`, or `Un altre`. |

The panel writes corrected `full_name`, `email`, and `phone` values back to this table before creating external accounts.

### `Dinantia -> new_student_config`

Course routing configuration.

| Header | Required | Meaning |
| --- | --- | --- |
| `courses` | Yes | Course/level value. Must match `new_student_form.level`. |
| `email_coord` | Yes | Coordinator notification recipient for the selected course. |
| `email_digi` | Yes | Digital coordinator notification recipient for the selected course. |

## Access Control

`doGet()` and every server-side action use the shared access-control helpers in `AccessControl.js`.

Access is allowed only when:

1. The deployed web app receives a signed-in domain user.
2. `Session.getActiveUser().getEmail()` returns an email.
3. The email appears directly in `access_granted`, or belongs to a person assigned to one of the allowed càrrecs.

Role resolution:

1. Non-email entries in `access_granted` match `Càrrega lectiva -> carrecs` column A.
2. Assigned people are read from `carrecs` column D.
3. Institutional emails are resolved by matching those names against `Càrrega lectiva -> professors` column Q and reading column L.

This must remain server-side. The browser UI is not trusted for permissions.

Protected server entry points:

- `doGet()`
- `getPanelData()`
- `checkGoogleEmailAvailability(email)`
- `createStudentAccounts(request)`

Denied access behavior:

- `doGet()` renders an `Acces no autoritzat` page.
- Browser-callable server methods throw an error returned to the panel.

`grantRequiredPermissions()` touches the script properties, active user email, and the `Càrrega lectiva` lookup sheets so the deploying user can authorize the required scopes.

## Panel UI

The panel is a single-page admin table rendered by `AdminPanel.html`.

Page title:

```text
Gestió de noves incorporacions
```

Top toolbar:

- Status message
- `Actualitza` button

Table columns:

| Column | Behavior |
| --- | --- |
| `Dades de l'alumne` | Shows full student name, level, and contacts. Contact full name, phone, and email are editable. |
| `Usuari iernestlluch` | Shows proposed editable institutional email and a `Comprova` availability button. |
| `Usuari Dinantia` | Shows Dinantia ID and group autocomplete with selected group chips. |
| `Generar` | Starts the external account creation flow. |

## Data Loading Flow

When the page opens:

1. Browser calls `getPanelData()`.
2. Server checks access.
3. Server reads pending student rows from `Dinantia -> new_student_form`.
4. Server reads contact rows from `Dinantia -> new_student_form_contacts`.
5. Server groups contacts by student `id`.
6. Server filters out rows where `managed` parses as `TRUE`.
7. Server fetches all Dinantia groups with pagination.
8. Browser renders rows and keeps the group list in memory for local autocomplete.

Pending-row rule:

```javascript
!parseBoolean_(managed)
```

This accepts both real boolean `true` and string `"TRUE"` as managed.

## Institutional Email Proposal

For each pending student, the panel proposes:

```text
normalize(name + surname1 + day_of_month) + @iernestlluch.cat
```

Example on the 9th day of the month:

```text
Marc Domingo Ruiz -> marcdomingo9@iernestlluch.cat
```

The email is editable. The final Google Workspace account uses the edited textbox value.

Email normalization for suggestions:

- Removes accents.
- Lowercases.
- Removes non-alphanumeric characters.

The `Comprova` button calls `checkGoogleEmailAvailability(email)`, which:

1. Repeats access control.
2. Requires `@iernestlluch.cat`.
3. Calls `AdminDirectory.Users.get(email)`.
4. Returns available/not available.

## Editable Contacts

The panel displays each contact with editable:

- `Nom complet`
- `Telèfon`
- `Correu electrònic`

`relation` is displayed but not currently editable.

When `Generar` is clicked, the browser sends the edited contact values with the request. The backend validates that each submitted contact row number belongs to the current student request before accepting changes.

Before creating external accounts, the backend writes corrected contact values back to `Dinantia -> new_student_form_contacts`.

## Phone Rules

Contact phones are normalized before Dinantia creation.

Accepted:

| Input | Normalized value |
| --- | --- |
| `666221996` | `+34666221996` |
| `34666221996` | `+34666221996` |
| `+34666221996` | `+34666221996` |

Rejected:

| Input | Reason |
| --- | --- |
| `333443333` | Spanish local number does not start with `6`, `7`, `8`, or `9`. |
| `+34333443333` | Same invalid Spanish local prefix after `+34`. |
| Any other nonmatching format | Cannot be safely normalized for Dinantia. |

## Dinantia Group Picker

Dinantia groups are fetched live on panel load from:

```http
GET /v1/groups/index?limit=100&page=N
```

Pagination continues until `pagination.has_next_page` is false.

Each group is normalized into:

```javascript
{
  id,
  name,
  tag,
  parent,
  types
}
```

The browser stores the full group list in memory and filters locally while typing. Search matches:

```text
group.id + group.name + group.tag
```

Selected groups are shown as removable chips.

At least one Dinantia group must be selected before account creation.

## Creation Flow

`Generar` calls `createStudentAccounts(request)`.

Request payload:

```javascript
{
  rowNumber,
  institutionalEmail,
  groupIds,
  contacts
}
```

Server sequence:

1. Check access.
2. Normalize and validate institutional email.
3. Normalize selected Dinantia group IDs.
4. Load the source student row by row number.
5. Reject if `managed` is already `TRUE`.
6. Sanitize submitted editable contacts.
7. Normalize contact phones.
8. Fetch current Dinantia groups.
9. Load `new_student_config` for the student's `level`.
10. Validate required student fields.
11. Check Google Workspace email availability.
12. Check Dinantia account ID availability.
13. Validate selected Dinantia group IDs against the fetched group list.
14. Validate contact names, emails, phones, and relations.
15. Write corrected contact values back to `new_student_form_contacts`.
16. Create the Google Workspace user.
17. Create the Dinantia student account.
18. Send completion notification email.
19. Set `new_student_form.managed` to `TRUE`.

If any step fails, the function throws an error and the row remains visible for correction/retry. `managed` is only set after all previous steps succeed.

## Google Workspace User Creation

The panel creates the student user with Admin Directory:

```javascript
AdminDirectory.Users.insert(payload)
```

Payload shape:

```javascript
{
  primaryEmail: institutionalEmail,
  name: {
    givenName: student.name,
    familyName: student.surname1 + optional student.surname2
  },
  password: CONFIG_.initialStudentPassword,
  changePasswordAtNextLogin: true,
  orgUnitPath: '/Alumnes',
  recoveryEmail: firstContactEmailIfPresent
}
```

The initial password is configured as `institut`. The user must change it on first login. The password is included in the completion notification email so the office team can communicate it to the student.

## Dinantia Student Creation

The panel creates a Dinantia student through:

```http
POST /v1/accounts/update
```

The integration uses the Dinantia API credentials from script properties and sends:

```javascript
{
  id: student.id,
  name: fullStudentName,
  email: institutionalEmail,
  gender: 'other',
  language: 'ca_ES',
  roles: ['Student'],
  groups: {
    member: selectedGroupIds
  },
  parents: [
    {
      name: contact.fullName,
      email: contact.email,
      phone: normalizedPhone,
      role: 'Parent',
      gender: mappedGender
    }
  ],
  fields: []
}
```

Parent gender mapping:

| relation | Dinantia gender |
| --- | --- |
| `Mare` | `female` |
| `Pare` | `male` |
| `Un altre` | `other` |

The contact `relation` value is not sent to Dinantia because it is not a documented parent field. It is only used locally and in notification emails.

## Notification Email

After both external accounts are created, the panel sends a summary email to:

- `equip_directiu@iernestlluch.cat`
- `email_coord` for the selected level in `new_student_config`
- `email_digi` for the selected level in `new_student_config`

The email includes:

- Student identifier
- Full student name
- Name
- First surname
- Second surname
- Level
- Generated institutional email
- Selected Dinantia group IDs and labels
- Every contact full name, email, phone, and relation

## Logging

The panel writes structured logs with safe operational metadata only. Logs do not contain credentials, Basic Auth headers, or initial passwords.

Important stages:

- `getPanelData:start`
- `getPanelData:success`
- `createStudentAccounts:start`
- `createStudentAccounts:contextLoaded`
- `createStudentAccounts:contactsSanitized`
- `createStudentAccounts:dinantiaGroupsLoaded`
- `createStudentAccounts:courseConfigLoaded`
- `createStudentAccounts:validated`
- `createStudentAccounts:contactsUpdated`
- `createStudentAccounts:googleUserCreated`
- `createDinantiaStudent:payloadReady`
- `dinantiaFetch:start`
- `dinantiaFetch:response`
- `createStudentAccounts:dinantiaUserCreated`
- `createStudentAccounts:notificationSent`
- `createStudentAccounts:managedSet`
- `createStudentAccounts:failed`

Browser behavior:

- Shows row-level success/error messages.
- Re-enables the button on server failure.
- Shows a 2-minute watchdog message if the server has not responded.

## OAuth Scopes And Services

The manifest enables the Admin Directory advanced service:

```json
{
  "userSymbol": "AdminDirectory",
  "serviceId": "admin",
  "version": "directory_v1"
}
```

OAuth scopes:

| Scope | Reason |
| --- | --- |
| `userinfo.email` | Read active user email for access control. |
| `script.external_request` | Call Dinantia API with `UrlFetchApp`. |
| `script.send_mail` | Send completion notification email. |
| `spreadsheets` | Read/write shared database sheets. |
| `admin.directory.user` | Create Google Workspace users. |
| `admin.directory.user.readonly` | Read users for email availability checks. |

## Files

| File | Responsibility |
| --- | --- |
| `src/AdminPanel.html` | Admin table UI, editable contacts, group picker, row actions. |
| `src/Panel.js` | Main server-side panel actions and creation workflow. |
| `src/AccessControl.js` | Shared role/email access decision, no-access page, and permission helper. |
| `src/Workspace.js` | Google Workspace user operations and compatibility wrapper for server-side access checks. |
| `src/DinantiaClient.js` | Dinantia API client, group loading, account checks, student creation. |
| `src/Database.js` | Shared spreadsheet registry and header helpers. |
| `src/Config.js` | Local constants: sheet names, OU paths, domains, defaults. |
| `src/Debug.js` | Safe structured logging helpers. |
| `src/appsscript.json` | Manifest, advanced service, OAuth scopes, web app settings. |

## Failure Model

The current implementation is intentionally conservative:

- If validation fails, no external accounts are created.
- If Google creation fails, Dinantia is not called.
- If Dinantia creation fails, `managed` is not set to `TRUE`.
- If notification email fails, `managed` is not set to `TRUE`.
- If `managed` is not `TRUE`, the row remains visible for retry.

Known operational caveat:

- If Google Workspace user creation succeeds but Dinantia creation fails, the Google user already exists. On retry, the current flow will stop at the Google email availability check unless the admin changes the email or the code is later extended to treat an already-created matching Google user as resumable.

## Open Decisions

- Whether `relation` should become editable in the panel.
- Whether student Dinantia group membership should use only `member` or additional scopes.
- Whether the flow should support resumable retries after Google creation succeeds but Dinantia fails.
