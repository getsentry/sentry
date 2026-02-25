# Billing Platform Services

This directory contains the implementation of billing services. Each subdirectory represents a distinct service with well-defined boundaries.

## Service Guidelines

### Service Boundaries

**CRITICAL**: Services should **BY NO MEANS** import code across service lines. Services should communicate with each other using the `BillingService` abstraction.

```python
# ❌ WRONG: Importing across service boundaries
from sentry.billing.platform.services.contract.models import Contract

# ✅ CORRECT: Use service methods
from sentry.billing.platform.services.contract import ContractService
contract = ContractService().get_contract(GetContractRequest(organization_id=1))
```

### Service Structure

Each service should be in its own directory with the following structure:

```
services/
└── contract/           # Service name
    ├── __init__.py     # Exports the service class
    ├── service.py      # Service implementation
    └── ...             # Internal implementation files
```

### Creating a New Service

1. Create a new directory for your service
2. Create a service class that inherits from `BillingService`
3. Define service methods decorated with `@service_method`
4. Ensure all interfaces use protobuf messages

Example:

```python
# services/contract/service.py
from sentry.billing.platform.core import BillingService, service_method
from sentry_protos.billing.v1.services.contract import GetContractRequest, GetContractResponse


class ContractService(BillingService):
    @service_method
    def get_contract(self, request: GetContractRequest) -> GetContractResponse:
        # Implementation
        pass

# services/contract/__init__.py
from .service import ContractService

__all__ = ["ContractService"]
```

## Available Services

_Services will be listed here as they are implemented._
