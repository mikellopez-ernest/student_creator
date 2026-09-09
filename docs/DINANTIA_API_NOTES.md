# Dinantia API Notes

These notes summarize the local Dinantia API documentation stored in `docs/Dinantia-API-Documentation/`.

They are not a replacement for the source documentation. Future specs should refer back to the detailed module files when defining exact request or response contracts.

## Source Documentation

| Path | Purpose |
| --- | --- |
| `docs/Dinantia-API-Documentation/README.md` | API overview, base URL pattern, headers, and authentication. |
| `docs/Dinantia-API-Documentation/Accounts.md` | Accounts, roles, groups, permissions, parents, custom fields. |
| `docs/Dinantia-API-Documentation/Groups.md` | Group hierarchy and messaging group definitions. |
| `docs/Dinantia-API-Documentation/Classes.md` | Timetable classes, teacher account, school hour, course, and group links. |
| `docs/Dinantia-API-Documentation/Courses.md` | Course list, creation, update, view, and deletion. |
| `docs/Dinantia-API-Documentation/Attendances.md` | Attendance records and attendee statuses. |
| `docs/Dinantia-API-Documentation/Fields.md` | Custom field definitions. |
| `docs/Dinantia-API-Documentation/School-Hours.md` | School hour catalog. |
| `docs/Dinantia-API-Documentation/Webhooks.md` | Webhook registration and webhook signing secret behavior. |
| `docs/Dinantia-API-Documentation/CRM-Classes.md` | CRM classes and available capacity. |
| `docs/Dinantia-API-Documentation/CRM-Candidacies.md` | CRM candidacies, statuses, stages, and stage logs. |
| `docs/Dinantia-API-Documentation/CRM-Funnels.md` | CRM funnels and stages. |

The generation report lists 39 endpoints across 11 modules.

## API Basics

- API version documented: `1.2.0`.
- Base URL pattern: `https://yourdomain.dinantia.com/api/web`.
- Required headers:
  - `Accept: application/vnd.api+json`
  - `Content-Type: application/vnd.api+json`
- Authentication uses Basic Authentication.
- The User and Secret are obtained from the school's Dinantia general settings.
- Credentials are stored in Apps Script script properties:
  - `dinantia_api_user`
  - `dinantia_api_secret`

## Security Rules

- Do not commit Dinantia API credentials.
- Do not store Dinantia API credentials in source files or docs.
- Do not include Basic Auth values in logs, specs, examples, or generated artifacts.
- Webhook `signing_secret` is only displayed on creation response and must be treated as a secret.
- Dinantia API credentials must be read from script properties `dinantia_api_user` and `dinantia_api_secret`.
- Missing or blank Dinantia credential properties must produce clear configuration errors.

## Common API Patterns

Many index endpoints use:

| Parameter | Meaning |
| --- | --- |
| `limit` | Result set length. Defaults to 20; max 100. |
| `page` | Result set page. Defaults to first page. |

Many list responses include:

| Field | Meaning |
| --- | --- |
| `data` | Returned records. |
| `pagination` | Pagination metadata. |
| `code` | Request status code. |
| `url` | Request URL. |
| `success` | Request success flag. |

Pagination metadata commonly includes:

- `page_count`
- `current_page`
- `has_next_page`
- `has_prev_page`
- `count`
- `limit`

Specs that read full collections must account for pagination and use a max page size of 100 when appropriate.

## Accounts

Relevant endpoints include:

- `GET /v1.2/accounts/index`
- `GET /v1/accounts/index`
- `GET /v1.2/accounts/view/:id`
- `GET /v1/accounts/view/:id`
- `POST /v1.2/accounts/update/:id`
- `POST /v1/accounts/update/:id`
- `DELETE /v1/accounts/delete/:id`

Account objects include:

- `id`
- `name`
- `email`
- `phone`
- `gender`
- `language`
- `avatar`
- `roles`
- `groups`
- `permissions`
- `parents`
- `fields`
- `created`
- `modified`

Important roles:

- `Administrator`
- `Staff`
- `Student`
- `Parent`
- `Candidate`
- `CandidateParent`

Account group scopes include:

- `member`
- `tutor`
- `teacher`
- `managed`
- `view_students`
- `attendances`
- `attitude`
- `calendar`
- `messages`
- `newsletter`
- `nursery`
- `payments`
- `wall`

By now, this app does not need to map local teachers to Dinantia `account_id`.

## Groups

Relevant endpoints include:

- `GET /v1/groups/index`
- `GET /v1/groups/view/:id`
- `POST /v1/groups/update/:id`
- `DELETE /v1/groups/delete/:id`

Group objects include:

- `id`
- `name`
- `tag`
- `parent`
- `types`
- `created`

Group `types` may include `students`, `parents`, or both.

`GET /v1/groups/index` can filter by `parent`. Group tags are built from the chain of group names from the root to the group.

The current local table `Dinantia -> dinantia_2_dades_alumnes` stores `dinantia_group_name`, which maps to the Dinantia group value used by the app.

Teacher/responsibility visibility is stored separately in `Dinantia -> teachers_2_dinantia`.

A worked temporary Apps Script example for resolving a teacher email to a Dinantia group and listing students is documented in `docs/examples/DINANTIA_GROUP_STUDENTS_LOOKUP_EXAMPLE.md`.

## Classes

Relevant endpoints include:

- `GET /v1.2/classes/index`
- `GET /v1.2/classes/view/:id`
- `POST /v1.2/classes/update/:id`
- `DELETE /v1.2/classes/delete/:id`

Class objects include:

- `id`
- `weekday`
- `school_hour_id`
- `account_id`
- `available_for_substitutions`
- `course_id`
- `classroom`
- `groups`

`weekday` uses `1` for Monday through `7` for Sunday.

When creating or updating a regular class:

- `account_id` is required.
- `school_hour_id` is required.
- `weekday` is required.
- `course_id` is required unless the class is a substitution slot.
- `groups` is required unless the class is a substitution slot.
- `available_for_substitutions` marks substitution/free slots.

By now, local teacher records do not need to map to Dinantia `account_id`. Future timetable specs still need to define any required mappings for local groups, Dinantia group IDs, and local timetable hours to Dinantia `school_hour_id`.

## Courses

Relevant endpoints include:

- `GET /v1/courses/index`
- `GET /v1/courses/view/:id`
- `POST /v1/courses/update/:id`
- `DELETE /v1/courses/delete/:id`

Course objects include:

- `id`
- `name`
- `created`

Deleting a course requires `replacement_id` to replace references in existing attendances.

## School Hours

Relevant endpoint:

- `GET /v1.2/school_hours/index`

School hour objects include:

- `id`
- `name`
- `start`
- `end`

`start` and `end` use `HH:mm:ss`.

## Attendances

Relevant endpoints include:

- `GET /v1/attendances/index`
- `GET /v1/attendances/view/:id`
- `POST /v1/attendances/update/:id`
- `DELETE /v1/attendances/delete/:id`

Attendance objects include:

- `id`
- `date`
- `account_id`
- `course_id`
- `groups`
- `attendees`

Attendee objects include:

- `account_id`
- `status`

When creating or updating attendance:

- `date` is required.
- `account_id` is required.
- Either `course` or `course_id` is required.
- `groups` is required.
- `attendees` is required.
- `notify` controls parent notification behavior for absent attendees.

The attendee account must be a member of at least one of the groups specified for the attendance.

## Fields

Relevant endpoints include:

- `GET /v1.2/fields/index`
- `GET /v1/fields/index`

Fields can be filtered by roles:

- `Student`
- `Candidate`
- `CandidateParent`
- `Staff`

Field objects include:

- `id`
- `roles` or `role`, depending on API version
- `scope`
- `name`
- `data_type`
- `multiple`
- `has_options`
- `options`
- `allow_custom`

## Webhooks

Relevant endpoints include:

- `GET /v1/webhooks/index`
- `GET /v1/webhooks/view/:id`
- `POST /v1/webhooks/update/:id`
- `DELETE /v1/webhooks/delete/:id`

Webhook objects include:

- `id`
- `endpoint`
- `types`
- `active`
- `signing_secret`, only in creation response

Webhook event type details are referenced in the Dinantia web app under `Developers > Webhooks`.

## CRM Modules

CRM modules are documented but not currently part of the registered app database structure.

Relevant modules:

- `CRM-Classes`
- `CRM-Candidacies`
- `CRM-Funnels`

CRM classes expose class capacity and period/course metadata.

CRM candidacies expose:

- candidate account
- CRM class
- status
- status data
- current stage
- stage history

CRM funnels expose funnel stages and stage ordering.

Future CRM-related specs should be written separately from the current group/tutor lookup specs.
