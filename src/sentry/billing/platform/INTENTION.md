This file is to only be modified by humans. It is meant to capture the INTENTION behind the choices in this repository. AI can generate an accurate-ish description by analyzing the structure of the code. It cannot infer what it is the humans were trying to do at the time.

# Core Intention

This folder defines interfaces for the new billing platform. No billing implementation should live in this repository, The only exception is the Usage service which is available in self-hosted and in the sentry SaaS deployment.

This is meant to be a rewrite of the existing code in `getsentry/services/billing`. The approach is to split the current spaghetti code functionality into services with well defined service boundaries.

# Folder structure

````
```txt
core/ - contains core primitives for working with services. no application specific code should live here
services/ - each folder in this directory contains code for a "service", services should BY NO MEANS import code across service lines. Services should speak to each other using the BillingService abstraction.

````

# Key Abstractions

## BillingService

Part of the `core` library. Each service is a class that exports specific functions as service interfaces. These service interfaces should accept as input and return protobuf structs.

The interface to call a billing service should look something like:

```python
# this example is meant to illustrate the intention, the nuances of the interface may change
from getsentry.services.billing import BillingService
from sentry_protos.billing.v1.sevices.contract import GetContractRequest, GetContractResponse


class ContractService(BillingService):

    @service_method  # denotes that this method can be called external to this service. The decorator also includes base functionality for service endpoints e.g. metrics/observability
    def get_contract(self, request_proto: GetContractRequest) -> GetContractResponse:
        # implementation here
        pass

contract_proto = ContractService().get_contract(GetContractRequest(organization_id=1))
```

The key things to underline with this abstraction:

1. All BillingService subclasses should have no `__init__` arguments, they should be uniform
2. service methods (i.e. those that are meant to be called by other services) are exported in a standard way such that all service method behaviors can be modified when needed.
3. All interfaces are strongly typed with protobufs.
4. The eventual path for these services is to not have any of their implementation in this repository and these service objects (whose interfaces remain the same) will just pass the protobuf on to an external service.
