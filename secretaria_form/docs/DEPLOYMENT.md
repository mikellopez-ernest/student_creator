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

- Accessible by domain users.
- Executed as the user who deployed the version.

Keep `.clasp.json` local and uncommitted.
