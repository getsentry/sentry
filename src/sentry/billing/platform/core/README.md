# Billing Platform Core

Core primitives for working with billing services. No application-specific code should live in this directory.

## BillingService

The `BillingService` base class is the foundation for all billing services. Each service should inherit from this class and define methods decorated with `@service_method`.

### Key Principles

1. **Uniform Construction**: All services have no `__init__` arguments
2. **Protobuf Interfaces**: All service methods accept and return protobuf messages
3. **Service Boundaries**: Services should not import across service boundaries
4. **Observability**: The `@service_method` decorator automatically adds logging and metrics

### Basic Usage

```python
from sentry.billing.platform.core import BillingService, service_method
from sentry_protos.billing.v1.services.contract import GetContractRequest, GetContractResponse


class ContractService(BillingService):
    @service_method
    def get_contract(self, request: GetContractRequest) -> GetContractResponse:
        # Implementation here
        contract_id = f"contract_{request.organization_id}"
        return GetContractResponse(contract_id=contract_id)


# Usage
service = ContractService()
response = service.get_contract(GetContractRequest(organization_id=1))
```

### Service Method Decorator

The `@service_method` decorator provides:

- **Type Validation**: Ensures input and output are protobuf messages
- **Logging**: Logs start, success, and error events with timing information
- **Error Handling**: Captures and logs exceptions while allowing them to propagate
- **Observability**: Structured logging with service name, method name, and duration

Example log output:

```
billing.service.method.start (service='ContractService' method='get_contract' request_type='GetContractRequest')
billing.service.method.success (service='ContractService' method='get_contract' duration_ms=2.5 response_type='GetContractResponse')
```

### Testing

Service methods are easy to test since services are stateless and have uniform construction:

```python
def test_contract_service():
    service = ContractService()
    request = GetContractRequest(organization_id=1)
    response = service.get_contract(request)

    assert response.contract_id == "contract_1"
```

See `tests/sentry/billing/platform/core/test_service.py` for comprehensive test examples.

### Future Direction

The eventual goal is for these services to be implemented externally. The service interfaces will remain in this repository, but implementations will delegate to external services via RPC calls. The protobuf interfaces ensure this transition will be seamless.
