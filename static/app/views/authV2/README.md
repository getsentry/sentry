# Auth V2

- This folder keeps authentication frontend code in a single place until we have to roll it out further.
- The folder for backend code is `src/sentry/auth_v2/`

- There are relevant code in `static/app/views/auth/` that is worth a closer look

---

### Using on production

1. Install [Requestly](https://chromewebstore.google.com/detail/requestly-supercharge-you/mdnleldcmiljblolnjhpnblkcekpdkpa) on Chrome
2. Create a rule: if URL contains "sentry.io", add request header "X_SENTRY_AUTH_V2" with a secret value
3. Check the Ecosystem team's vault or ask Danny Lee for the secret
