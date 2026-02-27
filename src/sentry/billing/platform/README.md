# Billing Platform

Interface definitions for the new billing platform. See `INTENTION.md` for design principles.

## Architecture

Service-oriented architecture with:

- Well-defined service boundaries (no cross-service imports)
- Protobuf interfaces for all service methods
- Uniform service construction (no `__init__` arguments)
- Built-in observability (metrics, logging)

## Directory Structure

```
platform/
├── INTENTION.md    # Design principles (human-maintained)
├── core/           # BillingService base class and decorator
└── services/       # Individual service implementations
```

## Quick Start

```python
from sentry.billing.platform.core import BillingService, service_method
from sentry_protos.billing.v1.services.myservice import MyRequest, MyResponse


class MyService(BillingService):
    @service_method
    def my_method(self, request: MyRequest) -> MyResponse:
        return MyResponse(...)


# Usage
response = MyService().my_method(MyRequest(...))
```

## Testing

```bash
pytest -svv --reuse-db tests/sentry/billing/platform/
```

See `tests/sentry/billing/platform/core/test_service.py` for examples.

## Future Direction

Service implementations will eventually move to external services. These interfaces will remain, delegating to RPC endpoints.
