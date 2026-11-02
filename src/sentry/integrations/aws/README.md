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

Setup and settings changes ask Seer to assume the role, test rejection of missing
and incorrect external IDs, and perform CloudWatch, CloudWatch Logs, and X-Ray
reads through the same signed MCP transport used by investigations. A failed or
unavailable verification prevents saving. Empty telemetry accounts are valid;
successful MCP initialization or tool discovery alone is not verification.

The AWS namespace also requires Seer's `codemode-runtime-mcp-providers` feature
and Sentry's `organizations:seer-infra-telemetry` feature. AWS exposes a generic
script tool, so its read-only authority comes from the STS policy. Seer signs each
HTTP request with service `aws-mcp` in the endpoint region, refreshes the
15-minute customer sessions before expiry, and refuses alternate credential
destinations and redirects.

Local tests use botocore's validated STS stub responses and an in-process MCP
server. Before rollout, verify a sandbox AWS account end-to-end, including
credential expiry, telemetry reads, and IAM rejection of writes despite a broader
customer role policy. No live AWS verification is implied by the local tests.
