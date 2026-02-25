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
└── contract/           # Service name
    ├── __init__.py     # Exports ContractService
    ├── service.py      # Service implementation
    └── ...             # Internal implementation files
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

_Services will be listed here as they are implemented._
