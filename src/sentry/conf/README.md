# Deployment configuration

This preparation release adds Django settings and promotion from `config.yml`
and `SENTRY_OPTIONS`. Integration credentials, email configuration and operational
flags continue to use their existing option readers and precedence. Existing
Option/ControlOption rows remain effective. Configuring a new setting alone does
not change those readers; deployment writers must continue writing the legacy
option as well until the consumer cutover.

The later consumer cutover switches the keys below to deployment settings.
Changes then require restarting the process. Before that cutover, reconcile each
candidate setting with the effective option value, including database rows and
runtime overrides. A nonempty candidate is insufficient: a differing stored
credential can currently take precedence over its configured fallback.

During preparation, an explicitly configured option key is promoted to its
candidate setting. Registered defaults and `None` option values do not replace a
direct setting. Existing GitHub login and email mappings retain their bootstrap
precedence and backend aliases. Setup wizard email credentials remain options.

Single organization mode reuses the GitHub integration app's client ID and
secret for login when the app option keys are absent and the corresponding
app settings are nonempty. When either modern app credential is configured,
login settings never backfill the empty partner into the integration credentials.
When deployment provenance selects the modern pair, GitHub login uses that pair
including empty values after any original app option values are promoted.
Original app option keys take precedence over direct app settings and
synthetic login backfills. GitHub login option keys retain their login remap
precedence. Plain bootstrap also copies the paired direct app
credentials into the login settings, even without the application initializer's
legacy app remap. This changes unused GitHub login settings in API gateway
bootstrap; API gateway has no GitHub login consumers.

The symbolicator, symbol server, and chart rendering enablement flags remain
runtime options until the consumer cutover.

`system.support-email` continues to use the legacy option read while the admin
API accepts updates. `SENTRY_SYSTEM_SUPPORT_EMAIL` is prepared for the later
cutover, which removes that editable option and switches the client config read.

| Option key                            | Django setting                           |
| ------------------------------------- | ---------------------------------------- |
| `auth-fly.client-secret`              | `SENTRY_AUTH_FLY_CLIENT_SECRET`          |
| `auth-google.client-secret`           | `SENTRY_AUTH_GOOGLE_CLIENT_SECRET`       |
| `aws-lambda.secret-access-key`        | `SENTRY_AWS_LAMBDA_SECRET_ACCESS_KEY`    |
| `codecov.signing_secret`              | `SENTRY_CODECOV_SIGNING_SECRET`          |
| `cursor-origin-app.private-key`       | `SENTRY_CURSOR_ORIGIN_APP_PRIVATE_KEY`   |
| `discord.bot-token`                   | `SENTRY_DISCORD_BOT_TOKEN`               |
| `discord.client-secret`               | `SENTRY_DISCORD_CLIENT_SECRET`           |
| `gcp.client-secret`                   | `SENTRY_GCP_CLIENT_SECRET`               |
| `github-app.client-secret`            | `SENTRY_GITHUB_APP_CLIENT_SECRET`        |
| `github-app.private-key`              | `SENTRY_GITHUB_APP_PRIVATE_KEY`          |
| `github-app.webhook-secret`           | `SENTRY_GITHUB_APP_WEBHOOK_SECRET`       |
| `mail.mailgun-api-key`                | `SENTRY_MAILGUN_API_KEY`                 |
| `msteams.client-secret`               | `SENTRY_MSTEAMS_CLIENT_SECRET`           |
| `slack.client-secret`                 | `SENTRY_SLACK_CLIENT_SECRET`             |
| `slack.signing-secret`                | `SENTRY_SLACK_SIGNING_SECRET`            |
| `slack-staging.client-secret`         | `SENTRY_SLACK_STAGING_CLIENT_SECRET`     |
| `slack-staging.signing-secret`        | `SENTRY_SLACK_STAGING_SIGNING_SECRET`    |
| `slack.verification-token`            | `SENTRY_SLACK_VERIFICATION_TOKEN`        |
| `sms.twilio-token`                    | `SENTRY_SMS_TWILIO_TOKEN`                |
| `vercel.client-secret`                | `SENTRY_VERCEL_CLIENT_SECRET`            |
| `vsts.client-secret`                  | `SENTRY_VSTS_CLIENT_SECRET`              |
| `vsts-limited.client-secret`          | `SENTRY_VSTS_LIMITED_CLIENT_SECRET`      |
| `vsts_new.client-secret`              | `SENTRY_VSTS_NEW_CLIENT_SECRET`          |
| `auth-fly.client-id`                  | `SENTRY_AUTH_FLY_CLIENT_ID`              |
| `auth-google.client-id`               | `SENTRY_AUTH_GOOGLE_CLIENT_ID`           |
| `msteams.app-id`                      | `SENTRY_MSTEAMS_APP_ID`                  |
| `sms.backend`                         | `SENTRY_SMS_BACKEND`                     |
| `github-app.id`                       | `SENTRY_GITHUB_APP_ID`                   |
| `github-app.name`                     | `SENTRY_GITHUB_APP_NAME`                 |
| `github-app.client-id`                | `SENTRY_GITHUB_APP_CLIENT_ID`            |
| `github-console-sdk-app.id`           | `SENTRY_GITHUB_CONSOLE_SDK_APP_ID`       |
| `slack.client-id`                     | `SENTRY_SLACK_CLIENT_ID`                 |
| `slack-staging.client-id`             | `SENTRY_SLACK_STAGING_CLIENT_ID`         |
| `msteams.client-id`                   | `SENTRY_MSTEAMS_CLIENT_ID`               |
| `msteams.tenant-id`                   | `SENTRY_MSTEAMS_TENANT_ID`               |
| `vercel.client-id`                    | `SENTRY_VERCEL_CLIENT_ID`                |
| `discord.application-id`              | `SENTRY_DISCORD_APPLICATION_ID`          |
| `discord.public-key`                  | `SENTRY_DISCORD_PUBLIC_KEY`              |
| `gcp.client-id`                       | `SENTRY_GCP_CLIENT_ID`                   |
| `vsts.client-id`                      | `SENTRY_VSTS_CLIENT_ID`                  |
| `vsts-limited.client-id`              | `SENTRY_VSTS_LIMITED_CLIENT_ID`          |
| `vsts_new.client-id`                  | `SENTRY_VSTS_NEW_CLIENT_ID`              |
| `aws-lambda.access-key-id`            | `SENTRY_AWS_LAMBDA_ACCESS_KEY_ID`        |
| `aws-lambda.account-number`           | `SENTRY_AWS_LAMBDA_ACCOUNT_NUMBER`       |
| `aws-lambda.cloudformation-url`       | `SENTRY_AWS_LAMBDA_CLOUDFORMATION_URL`   |
| `pagerduty.app-id`                    | `SENTRY_PAGERDUTY_APP_ID`                |
| `cursor-origin-app.id`                | `SENTRY_CURSOR_ORIGIN_APP_ID`            |
| `system.internal-url-prefix`          | `SENTRY_SYSTEM_INTERNAL_URL_PREFIX`      |
| `symbolicator.enabled`                | `SENTRY_SYMBOLICATOR_ENABLED`            |
| `symbolicator.options`                | `SENTRY_SYMBOLICATOR_OPTIONS`            |
| `symbolserver.enabled`                | `SENTRY_SYMBOLSERVER_ENABLED`            |
| `symbolserver.options`                | `SENTRY_SYMBOLSERVER_OPTIONS`            |
| `replay.storage.backend`              | `SENTRY_REPLAY_STORAGE_BACKEND`          |
| `replay.storage.options`              | `SENTRY_REPLAY_STORAGE_OPTIONS`          |
| `chart-rendering.enabled`             | `SENTRY_CHART_RENDERING_ENABLED`         |
| `chart-rendering.chartcuterie`        | `SENTRY_CHART_RENDERING_CHARTCUTERIE`    |
| `chart-rendering.storage.backend`     | `SENTRY_CHART_RENDERING_STORAGE_BACKEND` |
| `chart-rendering.storage.options`     | `SENTRY_CHART_RENDERING_STORAGE_OPTIONS` |
| `dsym.cache-path`                     | `SENTRY_DSYM_CACHE_PATH`                 |
| `releasefile.cache-path`              | `SENTRY_RELEASEFILE_CACHE_PATH`          |
| `mail.enable-replies`                 | `SENTRY_MAIL_ENABLE_REPLIES`             |
| `mail.reply-hostname`                 | `SENTRY_MAIL_REPLY_HOSTNAME`             |
| `system.support-email`                | `SENTRY_SYSTEM_SUPPORT_EMAIL`            |
| `system.security-email`               | `SENTRY_SYSTEM_SECURITY_EMAIL`           |
| `u2f.facets`                          | `SENTRY_U2F_FACETS`                      |
| `sms.twilio-account`                  | `SENTRY_SMS_TWILIO_ACCOUNT`              |
| `sms.twilio-number`                   | `SENTRY_SMS_TWILIO_NUMBER`               |
| `system.secret-key`                   | `SECRET_KEY`                             |
| `mail.backend`                        | `EMAIL_BACKEND`                          |
| `mail.subject-prefix`                 | `EMAIL_SUBJECT_PREFIX`                   |
| `github-login.client-id`              | `GITHUB_APP_ID`                          |
| `github-login.client-secret`          | `GITHUB_API_SECRET`                      |
| `github-login.require-verified-email` | `GITHUB_REQUIRE_VERIFIED_EMAIL`          |
| `github-login.base-domain`            | `GITHUB_BASE_DOMAIN`                     |
| `github-login.api-domain`             | `GITHUB_API_DOMAIN`                      |
| `github-login.extended-permissions`   | `GITHUB_EXTENDED_PERMISSIONS`            |
| `github-login.organization`           | `GITHUB_ORGANIZATION`                    |

Deployment settings writers temporarily record explicit assignments in
`SENTRY_CONFIGURED_OPTION_SETTINGS`, an immutable internal set of setting names.
This protects intentionally empty identifiers and secrets and false reply
settings from deprecated aliases. Aliases still populate missing legacy options
for existing readers, but do not overwrite an explicitly tracked modern setting.
Untracked settings retain the legacy alias precedence. The provenance is removed
when the deprecated writers and SaaS credential remaps are retired.

## Deployment prerequisites

The six application-state keys (`sentry:system-token`, `sentry:install-id`,
`sentry:latest_version`, `sentry:last_worker_ping`,
`sentry:last_worker_version`, and `sentry:version-configured`) remain on the
existing `options.get()`, `options.set()`, and `options.delete()` APIs and their
Option/ControlOption storage. This deployment settings mapping does not move or
retype those values.

Preserve the legacy option registrations and explicit option promotion during
the settings rollout. Verify effective-value equality for every mapped key in
every serving workload before deploying the consumer cutover. Compare the currently served option value
with the candidate setting from the actual cutover image and its full bootstrap,
including intentionally empty and false values, old aliases, database precedence
and credential rotations. Preparation promotion can mask differences that the
cutover exposes; equality on the preparation image alone is insufficient. Keep this evidence private;
never log secret values. Confirm Slack uses HMAC whenever it currently uses HMAC;
a configured verification token cannot substitute for a missing signing secret.
No production parity evidence is supplied by this PR. The cutover must remain
blocked until this verification is complete. Continue both legacy and new writes
through the handover; remove the legacy writes only after every reader migrates.

Pause legacy ConfigMap delivery and drain or cancel queued and in-flight legacy applies before removing
deployment declarations from source. Protect exact ConfigMap revisions and rows;
old watchers must see unchanged legacy ConfigMaps until stopped, while new
namespace delivery remains active. Source merges do not prove serving rollout.

Deploy runtime schema coverage and preserved values before the later
authoritative read cutover. Runtime registration changes that need new schemas
belong to that cutover after schema deployment.
