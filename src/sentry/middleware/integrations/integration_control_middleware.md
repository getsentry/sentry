# Webhook Forwarding in Hybrid Cloud (Updated 06/2023)

## Background

Hybrid Cloud requires running Sentry in two different instances which communicate with one another; Control and Region Silos. The integration authentication data (`Integration`, and `OrganizationIntegration` models) will be stored in the **Control Silo**, but the associated models integrations may affect will be stored in the **Region Silo** (e.g. `Repository`, `Commit`, `ExternalIssue`, `Organization`, etc.).

Incoming webhooks fired by integration providers notify us when changes occur in their system (e.g. someone assigns an issue in slack, or a PR resolving an issue is merged on GitHub). These are **always** received by the Control Silo, so we need parsers to intercept these requests to forward the data to the relevant silos.

## How it Works

The magic happens in the [`IntegrationControlMiddleware`](src/sentry/middleware/integrations/integration_control.py). Here, we do the following steps:

- If an HTTP request is received to `/extensions/*` (which is the prefix for all our webhooks) it is further inspected. If not, we fall through this middleware.
- Next, we try to identify the parser from the provider, since these requests follow the pattern `/extensions/provider/webhook-path/`. If no parser is registered, we fall through this middleware
- If we've found a parser ([`BaseRequestParser`](src/sentry/middleware/integrations/parsers/base.py)), we defer to it for responding to the request, rather than falling through.

The parsers vary per integration but they follow the same basic steps:

- Read the data in the request and infer if it can be responded to from the Control Silo. If so, fall through the above middleware.
- If the request should be handled at one or more Region Silos instead, identify the `Integration` object from the request.
- Next, identify the organizations that care about the webhook from looking at `OrganizationIntegration`s
- Lastly, identify the relevant Region Silos we need to forward to from looking at the `OrganizationMapping`s.
- Now, depending on the payload we can choose how to respond to the initial request:
  - Some requests will require synchronous responses with an expected response pattern, (e.g. Slack).
  - Others don't care about the response, and we may opt to handle them asynchronously via the [`ControlOutbox` model](src/sentry/models/outbox.py), (e.g. GitHub).
  - And others may require fanning out identical webhooks to multiple regions where the integration is installed on an organization, (e.g. Jira).

## Adding Integration Parsers

The example of an integration parser may look something like this:

```python
class ExampleRequestParser(BaseRequestParser):
    provider = "example" # will match `/extensions/example/*` request paths

    def get_integration_from_request(self) -> Integration | None:
        integration_id = self.request.headers.get("X-Sentry-Integration-Id")
        return Integration.objects.filter(id=integration_id).first()

    def get_response(self):
        # You can use the url router to identify the endpoint/view the request is headed to
        if self.view_class in [ExampleConfigureView, ExampleSetupView]:
            return self.get_response_from_control_silo()

        # This method calls self.get_organizations_from_integration which calls self.get_integration_from_request.
        regions = self.get_regions_from_organizations()

        # If we're getting responses from multiple regions asynchronously...
        if '/async/' in self.request.path:
            return self.get_responses_from_outbox_creation(regions=regions)

        # If we're getting responses from multiple regions synchronously...
        response_map = self.get_responses_from_region_silos(regions=regions)
        # Require all forwarded requests to succeed...
        if not all([result.error is None for result in response_map.values()])
            return HttpResponse(status_code=200)

```

You can register it and start forwarding requests when Sentry is running as a Control Silo by adding it to [`integeration_control.py`](src/sentry/middleware/integrations/integration_control.py):

```diff
- ACTIVE_PARSERS = [SlackRequestParser]
+ ACTIVE_PARSERS = [SlackRequestParser, ExampleRequestParser]
```
