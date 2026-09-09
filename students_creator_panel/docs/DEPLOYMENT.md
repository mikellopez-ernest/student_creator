# students_creator_panel Deployment

Run commands from `students_creator_panel/`.

## Current Stable Web App

| Field | Value |
| --- | --- |
| Deployment ID | `AKfycbzYJNtJmhqx7vNR4pU0GXQrBdCTBmg8Lvtr2JLDYecbNRNDoQYxYhf7UyHcuWerUFNEuA` |
| URL | `https://script.google.com/a/macros/iernestlluch.cat/s/AKfycbzYJNtJmhqx7vNR4pU0GXQrBdCTBmg8Lvtr2JLDYecbNRNDoQYxYhf7UyHcuWerUFNEuA/exec` |

## Deploy Without Changing URL

```sh
npx clasp push --force
npx clasp version "Describe the change"
npx clasp redeploy AKfycbzYJNtJmhqx7vNR4pU0GXQrBdCTBmg8Lvtr2JLDYecbNRNDoQYxYhf7UyHcuWerUFNEuA --versionNumber VERSION --description "students_creator_panel web app"
```

Verify that the deployment is still a web app:

```sh
npx clasp open-web-app AKfycbzYJNtJmhqx7vNR4pU0GXQrBdCTBmg8Lvtr2JLDYecbNRNDoQYxYhf7UyHcuWerUFNEuA
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

Because the panel creates Google Workspace users and calls Dinantia, the deploying user must have the needed Admin Directory permissions and Dinantia API credentials in script properties.

Keep `.clasp.json` local and uncommitted.
