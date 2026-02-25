# Billing Platform

This directory defines interfaces for the new billing platform, following the principles outlined in `INTENTION.md`.

## Overview

The billing platform is designed to support a service-oriented architecture where:

1. **No billing implementation lives in this repository** (except the Usage service)
2. Services have well-defined boundaries and do not import across service lines
3. All service interfaces use protobuf messages for strong typing
4. Services communicate through the `BillingService` abstraction

## Directory Structure

```
platform/
├── INTENTION.md           # Core design principles (human-maintained)
├── README.md             # This file
├── core/                 # Core primitives (no application logic)
│   ├── __init__.py       # Exports BillingService, service_method
│   ├── service.py        # BillingService base class and decorator
│   └── README.md         # Core documentation
└── services/             # Service implementations
    └── README.md         # Service guidelines
```

## Quick Start

### Creating a Service

```python
from sentry.billing.platform.core import BillingService, service_method
from sentry_protos.billing.v1.services.myservice import MyRequest, MyResponse


class MyService(BillingService):
    @service_method
    def my_method(self, request: MyRequest) -> MyResponse:
        # Implementation
        return MyResponse(...)


# Usage
service = MyService()
response = service.my_method(MyRequest(...))
```

### Key Requirements

1. **Inherit from BillingService**: All services must extend `BillingService`
2. **No **init** arguments**: Services must have uniform construction
3. **Use @service_method**: All public service methods must be decorated
4. **Protobuf interfaces**: Input and output must be protobuf messages
5. **Respect service boundaries**: Never import across service directories

## Testing

Comprehensive test examples are available in:

- `tests/sentry/billing/platform/core/test_service.py`

Run tests with:

```bash
pytest -svv --reuse-db tests/sentry/billing/platform/
```

## Future Direction

The goal is to move service implementations out of this repository entirely. These service classes will remain, but their implementations will delegate to external services via RPC. The protobuf interfaces ensure this transition will be seamless.

## Documentation

- **INTENTION.md**: Core design principles (human-maintained, AI-readable)
- **core/README.md**: BillingService and service_method usage
- **services/README.md**: Service creation guidelines
