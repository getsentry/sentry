# Deployment configuration

Deployment configuration is read from Django settings when the process starts.
Changes to these values require restarting the process. Values stored with
`sentry config set` for the keys below are no longer read by their consumers.
Use `config.yml`, `SENTRY_OPTIONS` in `sentry.conf.py`, or the corresponding
Django setting instead.

Self-hosted deployments promote explicitly configured option keys into their
corresponding new settings. Registered defaults and `None` option values do not
replace a direct setting. The same rule applies to earlier self-hosted hostname,
filestore, analytics, viewer context, relay, and objectstore mappings: custom
`SENTRY_DEFAULT_OPTIONS` and null option values no longer replace those settings.
SaaS deployment options no longer promote into new
settings; configure the setting directly.
Existing GitHub login and email mappings retain their original bootstrap
precedence and backend aliases. Setup wizard email credentials remain options.

Self-hosted single organization mode reuses the GitHub integration app's client ID and
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

The symbolicator, symbol server, and chart rendering enablement flags are
also deployment settings; they no longer change while the process is running.

| Option key | Django setting |
| --- | --- |
| `auth-fly.client-secret` | `SENTRY_AUTH_FLY_CLIENT_SECRET` |
| `auth-google.client-secret` | `SENTRY_AUTH_GOOGLE_CLIENT_SECRET` |
| `aws-lambda.secret-access-key` | `SENTRY_AWS_LAMBDA_SECRET_ACCESS_KEY` |
| `codecov.signing_secret` | `SENTRY_CODECOV_SIGNING_SECRET` |
| `cursor-origin-app.private-key` | `SENTRY_CURSOR_ORIGIN_APP_PRIVATE_KEY` |
| `discord.bot-token` | `SENTRY_DISCORD_BOT_TOKEN` |
| `discord.client-secret` | `SENTRY_DISCORD_CLIENT_SECRET` |
| `gcp.client-secret` | `SENTRY_GCP_CLIENT_SECRET` |
| `github-app.client-secret` | `SENTRY_GITHUB_APP_CLIENT_SECRET` |
| `github-app.private-key` | `SENTRY_GITHUB_APP_PRIVATE_KEY` |
| `github-app.webhook-secret` | `SENTRY_GITHUB_APP_WEBHOOK_SECRET` |
| `mail.mailgun-api-key` | `SENTRY_MAILGUN_API_KEY` |
| `msteams.client-secret` | `SENTRY_MSTEAMS_CLIENT_SECRET` |
| `slack.client-secret` | `SENTRY_SLACK_CLIENT_SECRET` |
| `slack.signing-secret` | `SENTRY_SLACK_SIGNING_SECRET` |
| `slack-staging.client-secret` | `SENTRY_SLACK_STAGING_CLIENT_SECRET` |
| `slack-staging.signing-secret` | `SENTRY_SLACK_STAGING_SIGNING_SECRET` |
| `slack.verification-token` | `SENTRY_SLACK_VERIFICATION_TOKEN` |
| `sms.twilio-token` | `SENTRY_SMS_TWILIO_TOKEN` |
| `vercel.client-secret` | `SENTRY_VERCEL_CLIENT_SECRET` |
| `vsts.client-secret` | `SENTRY_VSTS_CLIENT_SECRET` |
| `vsts-limited.client-secret` | `SENTRY_VSTS_LIMITED_CLIENT_SECRET` |
| `vsts_new.client-secret` | `SENTRY_VSTS_NEW_CLIENT_SECRET` |
| `auth-fly.client-id` | `SENTRY_AUTH_FLY_CLIENT_ID` |
| `auth-google.client-id` | `SENTRY_AUTH_GOOGLE_CLIENT_ID` |
| `msteams.app-id` | `SENTRY_MSTEAMS_APP_ID` |
| `sms.backend` | `SENTRY_SMS_BACKEND` |
| `github-app.id` | `SENTRY_GITHUB_APP_ID` |
| `github-app.name` | `SENTRY_GITHUB_APP_NAME` |
| `github-app.client-id` | `SENTRY_GITHUB_APP_CLIENT_ID` |
| `github-console-sdk-app.id` | `SENTRY_GITHUB_CONSOLE_SDK_APP_ID` |
| `slack.client-id` | `SENTRY_SLACK_CLIENT_ID` |
| `slack-staging.client-id` | `SENTRY_SLACK_STAGING_CLIENT_ID` |
| `msteams.client-id` | `SENTRY_MSTEAMS_CLIENT_ID` |
| `msteams.tenant-id` | `SENTRY_MSTEAMS_TENANT_ID` |
| `vercel.client-id` | `SENTRY_VERCEL_CLIENT_ID` |
| `discord.application-id` | `SENTRY_DISCORD_APPLICATION_ID` |
| `discord.public-key` | `SENTRY_DISCORD_PUBLIC_KEY` |
| `gcp.client-id` | `SENTRY_GCP_CLIENT_ID` |
| `vsts.client-id` | `SENTRY_VSTS_CLIENT_ID` |
| `vsts-limited.client-id` | `SENTRY_VSTS_LIMITED_CLIENT_ID` |
| `vsts_new.client-id` | `SENTRY_VSTS_NEW_CLIENT_ID` |
| `aws-lambda.access-key-id` | `SENTRY_AWS_LAMBDA_ACCESS_KEY_ID` |
| `aws-lambda.account-number` | `SENTRY_AWS_LAMBDA_ACCOUNT_NUMBER` |
| `aws-lambda.cloudformation-url` | `SENTRY_AWS_LAMBDA_CLOUDFORMATION_URL` |
| `pagerduty.app-id` | `SENTRY_PAGERDUTY_APP_ID` |
| `cursor-origin-app.id` | `SENTRY_CURSOR_ORIGIN_APP_ID` |
| `system.internal-url-prefix` | `SENTRY_SYSTEM_INTERNAL_URL_PREFIX` |
| `symbolicator.enabled` | `SENTRY_SYMBOLICATOR_ENABLED` |
| `symbolicator.options` | `SENTRY_SYMBOLICATOR_OPTIONS` |
| `symbolserver.enabled` | `SENTRY_SYMBOLSERVER_ENABLED` |
| `symbolserver.options` | `SENTRY_SYMBOLSERVER_OPTIONS` |
| `replay.storage.backend` | `SENTRY_REPLAY_STORAGE_BACKEND` |
| `replay.storage.options` | `SENTRY_REPLAY_STORAGE_OPTIONS` |
| `chart-rendering.enabled` | `SENTRY_CHART_RENDERING_ENABLED` |
| `chart-rendering.chartcuterie` | `SENTRY_CHART_RENDERING_CHARTCUTERIE` |
| `chart-rendering.storage.backend` | `SENTRY_CHART_RENDERING_STORAGE_BACKEND` |
| `chart-rendering.storage.options` | `SENTRY_CHART_RENDERING_STORAGE_OPTIONS` |
| `dsym.cache-path` | `SENTRY_DSYM_CACHE_PATH` |
| `releasefile.cache-path` | `SENTRY_RELEASEFILE_CACHE_PATH` |
| `mail.enable-replies` | `SENTRY_MAIL_ENABLE_REPLIES` |
| `mail.reply-hostname` | `SENTRY_MAIL_REPLY_HOSTNAME` |
| `system.support-email` | `SENTRY_SYSTEM_SUPPORT_EMAIL` |
| `system.security-email` | `SENTRY_SYSTEM_SECURITY_EMAIL` |
| `u2f.facets` | `SENTRY_U2F_FACETS` |
| `sms.twilio-account` | `SENTRY_SMS_TWILIO_ACCOUNT` |
| `sms.twilio-number` | `SENTRY_SMS_TWILIO_NUMBER` |
| `system.secret-key` | `SECRET_KEY` |
| `mail.backend` | `EMAIL_BACKEND` |
| `mail.subject-prefix` | `EMAIL_SUBJECT_PREFIX` |
| `github-login.client-id` | `GITHUB_APP_ID` |
| `github-login.client-secret` | `GITHUB_API_SECRET` |
| `github-login.require-verified-email` | `GITHUB_REQUIRE_VERIFIED_EMAIL` |
| `github-login.base-domain` | `GITHUB_BASE_DOMAIN` |
| `github-login.api-domain` | `GITHUB_API_DOMAIN` |
| `github-login.extended-permissions` | `GITHUB_EXTENDED_PERMISSIONS` |
| `github-login.organization` | `GITHUB_ORGANIZATION` |

Deployment settings writers temporarily record explicit assignments in
`SENTRY_CONFIGURED_OPTION_SETTINGS`, an immutable internal set of setting names.
This protects intentionally empty identifiers and secrets and false reply
settings from deprecated aliases. Existing self-hosted legacy aliases keep their
precedence unless their target is explicitly tracked. The provenance is removed
when the deprecated writers and SaaS credential remaps are retired.

## Deployment prerequisites

Deploy setting support and the application state API before GetSentry's deployment
writers or newsletter state consumer. GetSentry's normal Sentry dependency bump
must include both parts of readiness. This cutover
requires those writers and consumers, the newsletter state consumer and direct
single tenant replay settings deployed everywhere and soaked. Verify candidate
settings and currently served values against every serving workload, including
jobs and canaries. Remove deployment values after stopping all legacy watchers,
so value removal does not delete their database rows through legacy sync.
Unused deployment schema entries may remain until final GetSentry cleanup.

Deploy runtime schema coverage, preserved runtime values and the aligned
GetSentry read hook before authoritative reads. Every serving workload must
mount its runtime options and feature namespaces. The Seer token metrics option
remains a runtime boolean; deploy its schema and preserve its currently served
value before deploying the automator registration added by this cutover.

Stop embedded reporters before starting the independent reporters. Verify one
observer per target and signed delivery for both namespaces before retiring all
legacy watcher workloads. Keep the database, declaration mirror, legacy pipeline
definition and protected configuration snapshots available for rollback. Archive
the exact externally delivered legacy ConfigMaps before infrastructure removal;
manifests alone do not contain their deployed values.

Export surviving deployment option rows before removing their registrations;
unregistered keys are excluded from legacy synchronization. Keep those exports
out of source control. Retain the previous settings and configuration artifacts
for rollback until the rollback window closes. Delete surviving rows only after
that window closes and their backups are confirmed.

After the settings rollout, SaaS single organization login always uses the direct
integration app credential pair, including empty partners. Retired app option
keys are neither promoted nor synthesized in SaaS. This remains true after the
temporary provenance is removed. Self-hosted GitHub app remapping retains its
legacy option and login precedence unless explicit deployment provenance selects
the modern pair.

## Authoritative runtime reads and state

SaaS options registered with `FLAG_AUTOMATOR_MODIFIABLE` resolve through the read
hook, then `SENTRY_OPTIONS`, `SENTRY_DEFAULT_OPTIONS` and registered defaults.
Reads, presence checks and update metadata never access the legacy store or
cache. Explicit hook and disk values include `None`, empty strings and false.
Unexpected read-hook failures propagate. SaaS setup wizard options use disk and
defaults directly. Every write channel and deletion rejects both classes before
storage mutation. Self-hosted configuration retains its store and permissions.

Global state uses the six-key application state API and the existing store/cache.
Unregistered `sentry:*` and `getsentry:*` runtime option names now reject; registered
runtime names and project/organization state remain supported. Audit all serving
and operational callers and verify state cache repair before retiring prefix
lookup. Roll back this cutover before reverting consumers to legacy options.
Keep the command and update channel until final retirement after guarded row
cleanup, fleet soak and rollback closure.

## Application state readiness

Global state has an explicit six-key API over the existing Option/ControlOption
store and cache. `sentry:system-token`, `sentry:install-id`,
`sentry:latest_version`, `sentry:last_worker_version`, and
`sentry:version-configured` require strings. `sentry:last_worker_ping` reads
numeric timestamps or legacy string fallbacks; booleans are invalid timestamps.
Writes require a string for the five string keys or a numeric timestamp for the
heartbeat, and record the `APPLICATION` update channel. State never uses the
runtime option read hook. Existing rows, cache keys, fallback behavior and token
generation are preserved, and legacy prefix lookup remains until GetSentry
consumers have migrated.

Before deployment, audit non-null values in both Option tables and explicit
configuration fallbacks for all six keys against those types. A stored null is a
miss; an explicitly configured null is invalid. Invalid stored or configured
read values raise `TypeError` without disclosing the value. Remediation requires
an owner decision; the API neither coerces nor rewrites invalid values. Verify
state cache repair and every serving and operational caller before retiring
legacy prefix lookup in the later cutover.
