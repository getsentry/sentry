# Integration Development

## Adding Integration

1. Create dir: `src/sentry/integrations/{name}/`
2. Required files:
   - `__init__.py`
   - `integration.py` (inherit from `Integration`)
   - `client.py` (API client)
   - `webhooks/` (if needed)
3. Register in `src/sentry/integrations/registry.py`
4. Add feature flag in `temporary.py`

## Integration Pattern

```python
# src/sentry/integrations/example/integration.py
from sentry.integrations import Integration, IntegrationProvider

class ExampleIntegration(Integration):
    def get_client(self):
        from .client import ExampleClient
        return ExampleClient(self.metadata['access_token'])

class ExampleIntegrationProvider(IntegrationProvider):
    key = "example"
    name = "Example"
    features = ["issue-basic", "alert-rule"]

    def build_integration(self, state):
        # OAuth flow handling
        pass
```
