# Supabase for Seer

This organization-level integration shares one Supabase OAuth grant with Seer. It does not
create personal identities or require each Sentry user to connect Supabase.

## OAuth App Configuration

Publish a Supabase OAuth app owned by Sentry. Configure its callback as
`https://<sentry-host>/extensions/supabase/setup/`, and grant only these read scopes:

| Scope                | Purpose                                           |
| -------------------- | ------------------------------------------------- |
| `organizations:read` | Identify the organization selected during consent |
| `projects:read`      | Discover projects in the authorized organization  |
| `analytics:read`     | Query project logs and scrape project metrics     |

Scopes are configured on the Supabase app, not requested through the deprecated `scope`
authorization parameter. Supabase's documented token response does not include granted
scopes, so the app registration is the credential-level permission boundary. If a token
response includes scopes, this integration checks them against the list above.

Use an organization-bound grant, not a member-bound grant. Leave project selection off so
an organization owner can authorize access across the organization's current and future
projects. Supabase's newer grant-configuration controls are rolling out separately; do not
depend on preview-only `grant_kind` or `project_scoping_mode` API parameters.

Set `SUPABASE_FOR_SEER_CLIENT_ID` and `SUPABASE_FOR_SEER_CLIENT_SECRET` in Sentry's server
configuration. Enable `organizations:integrations-supabase` and
`organizations:seer-infra-telemetry` in Sentry and `feature.codemode-runtime-openapi-providers`
in Seer for the organization.

## Management API access

Seer uses the Supabase Management API to list projects, query project logs, and read
current infrastructure and Postgres metrics. A scrape is a snapshot, not a historical
time series. The integration does not request permission to query application tables.

Access and refresh tokens are stored in encrypted integration metadata. Only the access
token is passed to Seer, encrypted with `SEER_GHE_ENCRYPT_KEY`. Token refresh is serialized
per integration and shared across Sentry organizations that separately authorized the
same Supabase organization. Uninstall revokes the grant only after its last live Sentry
organization installation is removed.

## Rollout Check

Before enabling this integration for customers, complete a live OAuth install with the
three read scopes above. List projects, query logs, and read a metrics snapshot from
two authorized projects, including after token refresh. Confirm projects outside the
authorized organization are inaccessible.

References: [OAuth integrations](https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration),
[logs permission](https://supabase.com/docs/reference/api/v1-get-project-logs), and
[metrics permission](https://supabase.com/docs/reference/api/v1-scrape-project-metrics).
