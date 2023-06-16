# Integration Proxying in Hybrid Cloud (Updated 06/2023)

## Background

Hybrid Cloud requires running Sentry in two different instances which communicate with one another; Control and Region Silos. The integration authentication data (`Integration`, and `OrganizationIntegration` models) will be stored in the **Control Silo**, but the associated models integrations may affect will be stored in the **Region Silo** (e.g. `Repostitory`, `Commit`, `ExternalIssue`, `Organization`, etc.).

When we send outbound requests to these integrations, they may be issued from either silo freely. For many integrations we will refresh our credentials if we receive a `403` response, or notice our existing token is expired prior to sending a request.

This introduces a problem, as integrations can be shared across regions. Since credentials are refreshed dynamically, network latency can introduce race conditions and cause us to save incorrect tokens, breaking the auth exchange and locking up integrations. To resolve this, we use a proxy client to ensure all outbound requests exit the Control Silo
