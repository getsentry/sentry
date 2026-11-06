# Deployment configuration

Deployment configuration is read from Django settings when the process starts.
Changes to these values require restarting the process. Values stored with
`sentry config set` for the keys below are no longer read by their consumers.
Use `config.yml`, `SENTRY_OPTIONS` in `sentry.conf.py`, or the corresponding
Django setting instead.

Self-hosted deployments promote non-null `SENTRY_OPTIONS` values for newly
migrated keys into their corresponding settings. Earlier self-hosted hostname,
filestore, analytics, viewer context, relay, and objectstore mappings retain
their legacy precedence: `SENTRY_DEFAULT_OPTIONS` promotes first, then
`SENTRY_OPTIONS` overrides it, including explicit `None`. SaaS deployment options
no longer promote into new settings; configure the setting directly.
Existing GitHub login and email mappings retain their original bootstrap
precedence and backend aliases. Setup wizard email credentials remain options.

Self-hosted single organization mode reuses the GitHub integration app's client ID and
secret for login when the app option keys are absent and the corresponding
app settings are nonempty. When either modern app credential is configured,
login settings never backfill the empty partner into the integration credentials.
Original app option keys take precedence over direct app settings and
synthetic login backfills. GitHub login option keys retain their login remap
precedence. Plain bootstrap also copies the paired direct app
credentials into the login settings, even without the application initializer's
legacy app remap. This changes unused GitHub login settings in API gateway
bootstrap; API gateway has no GitHub login consumers.

The symbolicator, symbol server, and chart rendering enablement flags are
also deployment settings; they no longer change while the process is running.

Client configuration reads support email from `SENTRY_SYSTEM_SUPPORT_EMAIL`.
The admin API rejects the retired `system.support-email` option; change the
deployment setting and restart the process to update the address.

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

SaaS deployment settings, including empty identifiers and secrets and false reply
settings, are never replaced by deprecated deployment aliases. Self-hosted legacy
aliases retain their existing precedence.

## Deployment prerequisites

Deploy Sentry #128309 and GetSentry #22648 in one normal-pinned GetSentry reader
image after their source prerequisites merge. Keep Sentry #126993 policy in a
separate serving release. Compare full initialization of the actual reader image
with currently effective option values in every workload, including jobs and
canaries. Preparation-only settings equality does not establish consumer parity.

Include database and runtime override precedence, conflicting or rotated
credentials, intentionally empty and false values, aliases, and mail backend
aliases. Require Slack to retain HMAC wherever it currently uses HMAC. A nonempty
credential or verification token cannot substitute for a matching signing secret.
No production parity evidence is supplied by this PR.

Deploy settings support before GetSentry preparation writers. Use normal merged
dependency pins, working runtime mounts, and matching replay configuration.
Keep compatibility writes until the reader release serves everywhere and policy
soak and rollback closure complete. Compare the final image again before removing
those writes, which can expose different aliases or defaults.

Stage runtime mirrors and preserved overrides through Automator #10302. Freeze
legacy ConfigMap delivery, drain queued and in-flight applies, and protect exact
ConfigMaps, matching declarations, and rows. Roll preparation images to watchers,
then convert them in place to reporter-only with Ops #24527 and `Recreate`.
Verify watcher termination in every context and one signed reporter per target
for both namespaces before Automator #10112 removes deployment declarations.
Keep new namespace delivery active and retain old ConfigMaps and rollback access.

Require parity for every retained runtime key and target before Sentry #126993.
Supply a mounted value or verify the intended local fallback against current
behavior, including cached values and null, false, or empty overrides. A missing
mounted value under authoritative policy can select a registered default instead
of the legacy DB value. Keep unresolved production evidence as a deployment blocker.
The Seer token metrics option remains a runtime boolean and needs its schema and
value parity before its automator registration serves.

Export surviving deployment rows before removing their registrations. Keep exports
private and retain protected snapshots through rollback closure. Delete reviewed
configuration rows only after policy soak, rehearsal, and rollback-window closure.
Use version 2 cleanup plans with explicit `rollback_closed_at`. Unused clients and
schemas may retire before individual row deletion once those paths cannot use
configuration rows. Keep inventory and restore tooling through table-removal gates.
Remove obsolete watcher IAM, RBAC, and restart permissions last.

The six application-state keys remain on the existing `options.get()`,
`options.set()`, and `options.delete()` APIs and their Option/ControlOption store
and cache. The keys are `sentry:system-token`, `sentry:install-id`,
`sentry:latest_version`, `sentry:last_worker_ping`, `sentry:last_worker_version`,
and `sentry:version-configured`.

After the settings rollout, SaaS single organization login always uses the direct
integration app credential pair, including empty partners. Retired app option
keys are neither promoted nor synthesized in SaaS. This remains true after the
temporary deployment ownership metadata is removed. Self-hosted GitHub app
remapping retains its legacy option and login precedence.

## Runtime option API and command retirement

SaaS options registered with `FLAG_AUTOMATOR_MODIFIABLE` resolve from the read
hook when a value is set, then `SENTRY_OPTIONS`, `SENTRY_DEFAULT_OPTIONS`, and
the registered default. They never read or populate the legacy store or cache.
Explicit hook and disk values include `None`, empty strings and false. Unexpected
read-hook failures propagate. SaaS setup wizard options resolve only from disk
and defaults. Every write channel and deletion rejects both classes before
storage mutation. Self-hosted options retain their existing storage and update
permissions.

Six persistent application keys retain their original `options.get/set/delete`
store and cache behavior: `sentry:system-token`, `sentry:install-id`,
`sentry:latest_version`, `sentry:last_worker_ping`, `sentry:last_worker_version`,
and `sentry:version-configured`. Their values, fallbacks, coercion and update
channels retain the existing option semantics. Other unregistered `sentry:*` and
`getsentry:*` names reject; registered runtime names and project/organization
state remain supported. Verify state cache repair before deployment.

`can_update` now accepts `(key, channel)`. The requested value and `include_drift`
arguments are removed because writability no longer depends on stored values or
the previous update channel. The `DRIFTED` rejection reason is removed.
`UpdateChannel.AUTOMATOR` remains solely as historical row metadata, including
protected application state and exact backup restoration. Manager and store
writes reject this channel before mutation, including on self-hosted instances.
Invalid channel objects raise `TypeError` instead of inheriting unrestricted
permissions. `APPLICATION`, `CLI`, `ADMIN`, `UNKNOWN`, and `KILLSWITCH` remain
supported for active writes. `sentry configoptions` is retired; `sentry config`
remains available for self-hosted option reads and writes. The three options used
only by legacy audit and webhook presenters are unregistered.

Deploy Sentry #126993 in a separate policy image after the combined reader
release serves everywhere and has been observed. Require parity for every
retained runtime key and target, including verified local fallback when no
mounted value exists. Include GetSentry #22652 tooling through normal merged
pins after checking their imports together. Installing tools must not run deletion.

All watcher processes must already be stopped. Require signed reporter delivery
for both namespaces and completed deployment-declaration removal. Verify policy
in every workload, including early startup and failed hook initialization.
Dormant legacy clients may remain, but no workload can invoke the retired command.
Preserve protected state, self-hosted storage, and historical update metadata.

Finish policy soak and rollback rehearsal, then close the rollback window before
row cleanup. Use exact reviewed version 2 plans with explicit
`rollback_closed_at`, protected durable backups, and guarded restoration. Closure
must follow soak and rehearsal. Keep inventory and restore tooling through the
later table-removal gates. Historical state reads and cache repair remain active.
No enum cleanup requires rewriting protected rows.

Retire unused clients and schemas after fleet readiness, policy soak, and rollback
closure once their retired paths cannot use configuration rows. Individual row
deletion need not precede that retirement. Keep application-state rows and the
store, cache, and synchronization task until their separate migration.

Deploy Sentry command and registration retirement before final GetSentry schema
and client cleanup. The transitional GetSentry deployment writers define their
own empty ownership set, so removing Sentry's default ownership setting does
not prevent those writers from initializing. SaaS app credentials and aliases
already use direct settings without that metadata. Remove the three presenter
schema entries and their new namespace values after this Sentry retirement.
