# Service Implementations

Individual billing services with strict boundaries.

## Service Boundaries

**CRITICAL**: Never import across service directories. Use service methods for cross-service communication.

```python
# ❌ WRONG: Direct import
from sentry.billing.platform.services.contract.models import Contract

# ✅ CORRECT: Service method
from sentry.billing.platform.services.contract import ContractService
contract = ContractService().get_contract(GetContractRequest(organization_id=1))
```

## Directory Structure

```
services/
├── contract/           # Contract management (lives in getsentry)
│   ├── __init__.py     # Exports ContractService
│   ├── service.py      # Service implementation
│   └── ...             # Internal implementation files
└── usage/              # Usage data retrieval
    ├── __init__.py     # Exports UsageService
    └── service.py      # Service implementation
```

## Creating a Service

1. Create service directory: `services/myservice/`
2. Implement service class inheriting from `BillingService`
3. Decorate methods with `@service_method`
4. Export service in `__init__.py`

```python
# services/myservice/service.py
from sentry.billing.platform.core import BillingService, service_method


class MyService(BillingService):
    @service_method
    def my_method(self, request: MyRequest) -> MyResponse:
        # Implementation
        pass
```

## Available Services

### UsageService (`usage/`)

Provides daily usage data for an organization within a date range. Returns usage broken down by day, with per-category totals.

The default implementation in sentry returns an empty response. GetSentry overrides this with Postgres/ClickHouse backends.

```python
from sentry.billing.platform.services.usage import UsageService
from sentry_protos.billing.v1.services.usage.v1.endpoint_usage_pb2 import GetUsageRequest

response = UsageService().get_usage(GetUsageRequest(organization_id=1))
```
