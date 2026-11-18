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
| `analytics:read`     | Query project logs                                |
| `database:read`      | Read security and performance advisors            |

Scopes are configured on the Supabase app, not requested through the deprecated `scope`
authorization parameter. Supabase's documented token response does not include granted
scopes, so the app registration is the credential-level permission boundary. If a token
response includes scopes, this integration checks them against the list above.

Use an organization-bound grant, not a member-bound grant. Leave project selection off so
an organization owner can authorize access across the organization's current and future
projects. Supabase's newer grant-configuration controls are rolling out separately; do not
depend on preview-only `grant_kind` or `project_scoping_mode` API parameters.

Set `SUPABASE_CLIENT_ID` and `SUPABASE_CLIENT_SECRET` in Sentry's server configuration.
Enable `organizations:integrations-supabase` and `organizations:seer-infra-telemetry` for
the Sentry organization. No frontend-specific configuration is required: the integration
uses the existing API-driven OAuth setup and Seer connector catalog.

## MCP Access

Seer receives the fixed URL:

```text
https://mcp.supabase.com/mcp?read_only=true&features=account,debugging
```

There is no `project_ref`, so Seer can discover and investigate projects across the
selected Supabase organization. Account tools provide project discovery; debugging tools
provide logs and advisors. Database queries, notebooks, deployment, storage, and branching
tool groups are not enabled. Read-only mode additionally disables mutating account tools.

Access and refresh tokens are stored in encrypted integration metadata. Only the access
token is passed to Seer, encrypted with `SEER_GHE_ENCRYPT_KEY`. Token refresh is serialized
per integration and shared across Sentry organizations that separately authorized the
same Supabase organization. Uninstall revokes the grant only after its last live Sentry
organization installation is removed.

## Rollout Check

Before enabling this integration for customers, complete a live OAuth install with the
four read scopes above, list MCP tools, and read logs/advisors from two projects in the
authorized organization. Confirm write tools and projects outside that organization are
inaccessible. Supabase's generic manual MCP setup documentation currently asks for all
write scopes; verify the narrower observability grant against the hosted service rather
than broadening this app's permissions to follow that generic recipe.

References: [OAuth integrations](https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration),
[MCP server](https://supabase.com/docs/guides/ai-tools/mcp),
[logs permission](https://supabase.com/docs/reference/api/v1-get-project-logs), and
[advisors permission](https://supabase.com/docs/reference/api/v1-get-performance-advisors).
