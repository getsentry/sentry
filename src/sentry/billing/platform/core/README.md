# Core Primitives

Base classes and decorators for billing services. No application-specific code.

## @service_method Decorator

Provides automatic observability for service methods:

**Metrics emitted:**

- `billing.service.method.called` - Method invocations
- `billing.service.method.success` - Successful completions
- `billing.service.method.error` - Failures (tagged with error_type)
- `billing.service.method.duration` - Timing (success and error)

All metrics include `service` and `method` tags.

**Validation:**

- Input must be a protobuf Message
- Output must be a protobuf Message

**Logging:**

Structured logs at start, success, and error with service name, method name, and duration.

## Example

```python
from sentry.billing.platform.core import BillingService, service_method
from sentry_protos.billing.v1.services.contract import GetContractRequest, GetContractResponse


class ContractService(BillingService):
    @service_method
    def get_contract(self, request: GetContractRequest) -> GetContractResponse:
        return GetContractResponse(contract_id=f"contract_{request.organization_id}")
```

All services are stateless with uniform construction (no `__init__` arguments).
