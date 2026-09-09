# Dinantia Student Creation Notes

This note captures the current Dinantia-specific assumptions used by `students_creator_panel`.

## Source Documentation

The local full Dinantia Accounts documentation used for this integration is available in another workspace:

```text
/Users/mikellopez/Documents/Codex/tutor_utils/tauler_tutor/docs/Dinantia-API-Documentation/Accounts.md
```

The shared project summary is:

```text
../../docs/DINANTIA_API_NOTES.md
```

## Endpoint

Student creation uses:

```http
POST /v1/accounts/update
```

with the configured base URL:

```text
https://app.dinantia.com/api/web
```

The effective URL is:

```text
https://app.dinantia.com/api/web/v1/accounts/update
```

## Headers

Required headers:

```text
Accept: application/vnd.api+json
Content-Type: application/vnd.api+json
Authorization: Basic base64(user:secret)
```

Credentials are read from Apps Script script properties:

- `dinantia_api_user`
- `dinantia_api_secret`

They must not be logged.

## Student Payload

Current payload:

```javascript
{
  id: student.id,
  name: buildFullName_(student),
  email: institutionalEmail,
  gender: 'other',
  language: 'ca_ES',
  roles: ['Student'],
  groups: {
    member: selectedGroupIds
  },
  parents: parents,
  fields: []
}
```

`student.id` is the identifier submitted in `secretaria_form`.

## Parent Payload

Each contact becomes one Dinantia parent object:

```javascript
{
  name: contact.fullName,
  email: contact.email,
  phone: contact.phone,
  role: 'Parent',
  gender: mappedGender
}
```

The local `relation` value is not sent to Dinantia because it is not a documented parent field.

Gender mapping:

| relation | Dinantia gender |
| --- | --- |
| `Mare` | `female` |
| `Pare` | `male` |
| `Un altre` | `other` |

## Phone Handling

Dinantia documents account and parent phone fields as E.164.

The panel currently accepts only Spanish local numbers that can be normalized safely:

| Input | Sent to Dinantia |
| --- | --- |
| `666221996` | `+34666221996` |
| `34666221996` | `+34666221996` |
| `+34666221996` | `+34666221996` |

Numbers whose local part starts with `3` are rejected before Dinantia creation because Dinantia rejected `+34333443333` with:

```text
Número de telèfon incorrecte.
```

## Groups

The panel sends selected group IDs under the `member` scope:

```javascript
groups: {
  member: selectedGroupIds
}
```

The selected IDs are validated against the current list returned by:

```http
GET /v1/groups/index?limit=100&page=N
```

## Error Handling

`dinantiaFetch_()` treats failures as errors when:

- HTTP status is outside `2xx`.
- Response body has `success: false`.
- Response body is not valid JSON.

If Dinantia returns `errors[]`, the message includes each field/code and message/detail.

Log paths redact email query parameters.

## Current Caveat

If Google Workspace creation succeeds and Dinantia creation fails, the process is not fully resumable yet. Retrying with the same email will fail Google email availability. A future iteration should support recognizing an already-created matching Google user and continuing with Dinantia.
