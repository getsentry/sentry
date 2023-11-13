# Integration Proxying in Hybrid Cloud (Updated 06/2023)

## Background

Hybrid Cloud requires running Sentry in two different instances which communicate with one another; Control and Region Silos. The integration authentication data (`Integration`, and `OrganizationIntegration` models) will be stored in the **Control Silo**, but the associated models integrations may affect will be stored in the **Region Silo** (e.g. `Repository`, `Commit`, `ExternalIssue`, `Organization`, etc.).

Outbound integration requests can come from either silo type, region or control. For many integrations we will refresh our credentials if we receive a `403` response, or notice our existing token is expired prior to sending a request. Since integrations can be shared across regions, this introduces a problem. When refreshing credentials from two separate region silos, network latency can introduce race conditions and cause us to save incorrect tokens, breaking the auth exchange and locking up integrations. To resolve this, we use a proxy client to ensure all outbound requests exit the Control Silo and only add auth data just before leaving.

## How it Works

The proxying is managed by the [`IntegrationProxyClient`](src/sentry/shared_integrations/client/proxy.py). It inherits from the `ApiClient` to act as a drop in replacement, except that it requires an `org_integration_id` to `__init__`, and `def authorize_request()` must be implemented. Before any request made with the client, it checks which silo is creating the request:

- If its in Monolith/Control mode, the client adds authentication data via `self.authorize_request` and proceeds as usual.
- If its in Region mode, the client does NOT add authentication data for the integration. Instead, it adds some headers ([PROXY_OI_HEADER and PROXY_SIGNATURE_HEADER](src/sentry/silo/util.py)) and sends the request to the control silo at a specific endpoint:
  ```
  {SENTRY_CONTROL_ADDRESS}/api/0/internal/integration-proxy # PROXY_BASE_PATH
  ```
  The [integration proxy endpoint](src/sentry/api/endpoints/internal/integration_proxy.py) parses the headers to verify the request is coming from a valid Region silo, and then replays the request with the proper authentication data (from `self.authorize_request`). The raw response is sent back to the originating silo to handle itself!

## Implementing the IntegrationProxyClient

Ensuring an integration proxies its requests can be done with three steps:

1. Replace the `ApiClient` base class with `IntegrationProxyClient`

```diff
- class ExampleApiClient(ApiClient):
+ class ExampleApiClient(IntegrationProxyClient):
```

2. Ensure all instances of the client pass in an `org_integration_id` on `__init__`.

```python
def get_client(self):
    return ExampleApiClient(org_integration_id=self.org_integration.id)
```

The helper method [`infer_org_integration`](src/sentry/shared_integrations/client/proxy.py) may help if you only have `integration_id` context.

```python
class ExampleApiClient(IntegrationProxyClient):
    def __init__(
        self,
        integration_id: int,
        org_integration_id: int | None = None
    ):
        if org_integration_id is None:
            org_integration_id = infer_org_integration(integration_id, logger)
        super.__init__(org_integration_id)
```

3. Implement the control-silo `authorize_request` method. It should handle all token refreshes and authentication headers.

```python
@control_silo_function
def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
    integration = Integration.objects.filter(organizationintegration__id=self.org_integration_id).first()
    if not integration:
        return prepared_request

    token_data = integration.metadata["auth_data"]
    if token["expiration"] > datetime.utcnow():
        token_data = self._refresh_and_save_token_data()

    prepared_request.headers["Authorization"] = f"Bearer {token_data["token"]}"
    return prepared_request
```
