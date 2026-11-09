# secretaria_form Deployment

Run commands from `secretaria_form/`.

## Current Stable Web App

| Field | Value |
| --- | --- |
| Deployment ID | `AKfycbzN13M7Lx3PE6QJWszTFWXRYxtjV6wKjSXoso6Qiiy81ie6oWELXjoEeBkN9UxRIoKcZg` |
| URL | `https://script.google.com/a/macros/iernestlluch.cat/s/AKfycbzN13M7Lx3PE6QJWszTFWXRYxtjV6wKjSXoso6Qiiy81ie6oWELXjoEeBkN9UxRIoKcZg/exec` |

## Deploy Without Changing URL

```sh
npx clasp push --force
npx clasp version "Describe the change"
npx clasp redeploy AKfycbzN13M7Lx3PE6QJWszTFWXRYxtjV6wKjSXoso6Qiiy81ie6oWELXjoEeBkN9UxRIoKcZg --versionNumber VERSION --description "secretaria_form web app"
```

Verify that the deployment is still a web app:

```sh
npx clasp open-web-app AKfycbzN13M7Lx3PE6QJWszTFWXRYxtjV6wKjSXoso6Qiiy81ie6oWELXjoEeBkN9UxRIoKcZg
```

The command should print the `/exec` URL.

## Deployment Settings

The manifest contains:

```json
"webapp": {
  "access": "DOMAIN",
  "executeAs": "USER_DEPLOYING"
}
```

This means:

- Accessible by domain users at the Apps Script layer.
- Executed as the user who deployed the version.

The code then applies the `access_granted` server-side allow-list before rendering the app or accepting form submissions.

## Access-Control Properties

Before deploying or testing, confirm these script properties exist:

| Property | Purpose |
| --- | --- |
| `db` | Resolves the registry spreadsheet and the `Càrrega lectiva` table used for role lookups. |
| `access_granted` | Comma-separated direct emails and/or càrrecs allowed to use the form. |
| `dinantia_api_user` | Dinantia API username used for withdrawal account lookup and deletion. |
| `dinantia_api_secret` | Dinantia API secret. |
| `dinantia_api_base_url` | Optional override; defaults to `https://app.dinantia.com/api/web`. |

If `access_granted` is missing or empty, the deployed app shows `Acces no autoritzat`.

The manifest requires `script.external_request` in addition to the existing spreadsheet, email, container UI, and active-user scopes. After adding this scope, the deploying user must authorize the new version before domain users can process withdrawals.

Run `grantRequiredPermissions()` manually if Apps Script asks the deploying user to authorize access to `Càrrega lectiva`. Authorize the external-request scope from the Apps Script editor or deployment flow as the deploying account.

## Post-Deployment Checks

Use the stable `/exec` URL and verify without completing a real withdrawal:

1. The root page shows `Crear alumne nou` and `Baixa d'alumne`.
2. `Crear alumne nou` opens the existing form and its `Tornar` link returns to the root.
3. `Baixa d'alumne` loads the group dropdown from `Dinantia -> students_cache`.
4. Selecting a group loads students and selecting a student opens the `Sí` / `No` confirmation modal, including the Dinantia, permanent-row, cache-deletion, and notification actions.
5. Choose `No` during smoke testing so no external account or spreadsheet row is changed.

Before the first production withdrawal, confirm that the logical table `Dades alumnes` is registered and that every supported sheet retains the documented A:M headers.

Keep `.clasp.json` local and uncommitted.
