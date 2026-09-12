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

If `access_granted` is missing or empty, the deployed app shows `Acces no autoritzat`.

Run `grantRequiredPermissions()` manually if Apps Script asks the deploying user to authorize access to `Càrrega lectiva`.

Keep `.clasp.json` local and uncommitted.
