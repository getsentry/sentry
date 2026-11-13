# AWS for Seer

AWS access is shared across the Sentry organization. This integration stores a
customer role ARN, MCP region, and server-generated external ID. It never stores
customer AWS access keys.

## Deployment Order

Deploy Seer's `aws_assume_role` connection model, AWS runtime provider,
request-signing transport, credential refresh, and
`/v1/monitoring-providers/aws/verify-connection` endpoint to **all** Seer workers
and API pods first. Older Seer pods reject the new connection discriminator.
Then deploy the Sentry backend and the setup UI in separate PRs. Keep
`organizations:integrations-aws` disabled until runtime configuration and live
verification are complete.

## Silos

Setup and settings run in the control silo, but each cell runs its own Seer, so
verification mirrors the GCP integration: the browser calls the org-scoped,
cell-silo endpoint
`/organizations/{org}/monitoring-providers/aws/verify-connection/`, which Synapse
routes to the organization's cell. That endpoint calls the cell's Seer directly
(it holds the request for up to `AWS_VERIFY_CONNECTION_TIMEOUT`, 90s, without
retries), records the outcome on the org integration config (with a staleness
guard against settings that have since changed), and returns it. The control-silo
setup pipeline never verifies; its verification step only accepts the outcome the
frontend obtained from the cell endpoint, cross-checked against the configured
role, and persists it at install time. Saving settings resets the stored status to
`unverified` until the settings UI re-verifies through the cell endpoint.

The only cross-silo call is the small `aws_seer.get_principal_arn` cell RPC
(`sentry/integrations/services/aws_seer`), which supplies the cell's Seer workload
ARN for the CloudFormation template. Seer-facing code in `client.py` runs only in
cells, and investigations build connections there too. As a result,
`aws-seer.principal-arn` is read only in cells and may differ per cell.

## Workload Identity

Configure Seer's AWS SDK credential chain to resolve a Sentry-owned IAM workload
role. On an OIDC-enabled workload, this can use `AWS_ROLE_ARN` and
`AWS_WEB_IDENTITY_TOKEN_FILE`, with the AWS OIDC provider and role trust policy
provisioned by infrastructure. A supported AWS SDK assume-role profile or workload
credential provider can also supply this identity. Running Seer on GCP alone does
not configure AWS federation.

Set Seer's `AWS_SEER_WORKLOAD_ROLE_ARN` and Sentry's `aws-seer.principal-arn` to
that role's IAM ARN. These settings assert the expected identity; they do not
provide credentials. Seer calls `GetCallerIdentity` before assuming a customer
role and rejects credentials resolving to a different account or role. The
workload role needs `sts:AssumeRole` on the customer roles; each customer role
must trust it and require that organization's external ID.

Customer roles must be created under the IAM path `/sentry-seer/`
(`AWS_CUSTOMER_ROLE_PATH`); the CloudFormation template sets it and
`parse_role_arn` rejects any other role. The workload role's policy in
getsentry/ops allows `sts:AssumeRole` only on `arn:aws:iam::*:role/sentry-seer/*`.
This is an allowlist: roles that trust Sentry's whole AWS account, such as the AWS
Lambda integration's `SentryRole`, stay out of Seer's reach. Keep the path in sync
across this module, Seer's role ARN validation, and the ops policy.

The external ID is persisted in the organization option `aws-seer.external-id`
before the CloudFormation template is returned. It survives pipeline expiry,
setup restarts, and reinstalls. Existing installations retain their external ID.

## Permission Boundary and Verification

Seer supplies its fixed `SEER_TELEMETRY_SESSION_POLICY` to every customer-role
assumption, including automatic refreshes. The policy allows only the telemetry
actions in the template and explicitly denies other actions, including role
chaining. Changing the customer's role policy cannot widen Seer's session beyond
that ceiling. Keep the template actions aligned with Seer's runtime policy when
adding a supported telemetry operation.

Verification asks Seer to assume the role, tests rejection of missing and
incorrect external IDs, and performs CloudWatch, CloudWatch Logs, and X-Ray reads
through the same signed MCP transport used by investigations. The recorded
`connection_status` must be `connected` before Seer treats the integration as
verified (`AwsOrgMonitoringProvider.is_verified`). Empty telemetry accounts are
valid; successful MCP initialization or tool discovery alone is not verification.

The AWS namespace also requires Seer's `codemode-runtime-mcp-providers` feature
and Sentry's `organizations:seer-infra-telemetry` feature. AWS exposes a generic
script tool, so its read-only authority comes from the STS policy. Seer signs each
HTTP request with service `aws-mcp` in the endpoint region, refreshes the
15-minute customer sessions before expiry, and refuses alternate credential
destinations and redirects.

Sentry's tests mock Seer's verification response. Before rollout, verify a sandbox
AWS account end-to-end, including credential expiry, telemetry reads, and IAM
rejection of writes despite a broader customer role policy.
