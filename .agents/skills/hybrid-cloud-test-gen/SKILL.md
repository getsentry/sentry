---
name: hybrid-cloud-test-gen
description: Generate hybrid cloud tests for the Sentry codebase. Use when asked to "generate HC test", "create hybrid cloud test", "write HC test", "add HC test", "write RPC test", "test RPC service", "silo test", "cross-silo test", "outbox test", "API gateway test", or "endpoint silo test". Covers RPC service tests, API gateway tests, outbox pattern tests, and API endpoint tests with silo decorators.
---

# Hybrid Cloud Test Generation

This skill generates tests for Sentry's hybrid cloud architecture. It covers RPC services, API gateway proxying, outbox patterns, and endpoint silo decorators.

## Critical Constraints

> **ALWAYS** use factory methods (`self.create_user()`, `self.create_organization()`) — never `Model.objects.create()`.

> **NEVER** wrap factory method calls in `assume_test_silo_mode` or `assume_test_silo_mode_of`. Factories are silo-aware and handle silo mode internally. Only use silo mode context managers for direct ORM queries (`Model.objects.get/filter/count/exists/delete`).

> **ALWAYS** use `pytest`-style assertions (`assert x == y`) — never `self.assertEqual()`.

> **ALWAYS** add tests to existing test files rather than creating new ones, unless no file exists for that module.

> For cross-silo ORM access: use `assume_test_silo_mode_of(Model)` when accessing a single model (auto-detects silo). Use `assume_test_silo_mode(SiloMode.X)` when the block covers multiple models or non-model operations.

> Use `TestCase` for most tests, including those using `outbox_runner()`. Only use `TransactionTestCase` when tests need real committed transactions (threading, concurrency, multi-process scenarios).

> **NEVER** use `from __future__ import annotations` in test files that deal with RPC models.

## Step 1: Identify Test Category

Determine which category of HC test to generate based on the user's request:

| Signal                                                                | Category             | Go To  |
| --------------------------------------------------------------------- | -------------------- | ------ |
| RPC service, service method, serialization round-trip, dispatch       | RPC Service Tests    | Step 3 |
| API gateway, proxy, middleware, forwarding                            | API Gateway Tests    | Step 4 |
| Outbox, cross-silo message, ControlOutbox, RegionOutbox, outbox drain | Outbox Pattern Tests | Step 5 |
| API endpoint with silo decorator, endpoint test, permission check     | Endpoint Silo Tests  | Step 6 |

If the signal is ambiguous, ask the user to clarify which category.

## Step 2: Gather Context

Before generating any test:

1. **Read the source module** being tested. Determine its silo mode by checking for `@region_silo_endpoint`, `@control_silo_endpoint`, `local_mode = SiloMode.X`, or `@region_silo_model`/`@control_silo_model` decorators.

2. **Find the existing test file** using the mirror path convention:
   - `src/sentry/foo/bar.py` → `tests/sentry/foo/test_bar.py`
   - `src/sentry/foo/services/bar/service.py` → `tests/sentry/foo/services/test_bar.py`
   - `src/sentry/foo/services/bar/impl.py` → `tests/sentry/foo/services/test_bar.py`

3. **Read the existing test file** to understand what's already tested, what base classes are used, and what patterns are established.

4. **Read source method signatures** to understand parameters, return types, and which RPC models are involved.

## Step 3: Generate RPC Service Tests

Load `references/rpc-service-tests.md` for complete templates and patterns.

RPC service tests must cover:

- **Silo compatibility**: `@all_silo_test` ensures the service works across all silo modes
- **Serialization round-trip**: `dispatch_to_local_service` verifies args/return survive serialization
- **Field accuracy**: Field-by-field comparison of RPC model against ORM object
- **Error handling**: Not-found returns, disabled methods, remote exception wrapping
- **Cross-silo effects**: `outbox_runner()` + `assume_test_silo_mode` for propagation checks

### Quick Reference — Decorator & Base Class

| Scenario                           | Decorator                                           | Base Class                       |
| ---------------------------------- | --------------------------------------------------- | -------------------------------- |
| Standard RPC service               | `@all_silo_test`                                    | `TestCase`                       |
| RPC with named regions             | `@all_silo_test(regions=create_test_regions("us"))` | `TestCase`                       |
| RPC with member mapping assertions | `@all_silo_test`                                    | `TestCase, HybridCloudTestMixin` |

## Step 4: Generate API Gateway Tests

Load `references/api-gateway-tests.md` for complete templates and patterns.

API gateway tests verify that requests to control-silo endpoints are correctly proxied to the appropriate region. They must cover:

- **Proxy pass-through**: Requests forwarded with correct params, headers, body
- **Query parameter forwarding**: Multi-value params preserved
- **Error proxying**: Upstream errors forwarded correctly
- **Streaming responses**: `close_streaming_response()` for reading proxied response body

### Quick Reference — Decorator & Base Class

| Scenario              | Decorator                                                                            | Base Class           |
| --------------------- | ------------------------------------------------------------------------------------ | -------------------- |
| Standard gateway test | `@control_silo_test(regions=[ApiGatewayTestCase.REGION], include_monolith_run=True)` | `ApiGatewayTestCase` |

## Step 5: Generate Outbox Pattern Tests

Load `references/outbox-tests.md` for complete templates and patterns.

Outbox tests verify that cross-silo messages are created, drained, and produce the expected side effects. They must cover:

- **Outbox creation**: Verify correct outbox records with `outbox_context(flush=False)`
- **Outbox processing**: `outbox_runner()` drains pending messages
- **Cross-silo side effects**: `assume_test_silo_mode_of(Model)` to check replica/mapping state
- **Idempotency**: Draining the same shard twice produces no duplicates

### Quick Reference — Decorator & Base Class

| Scenario                          | Decorator            | Base Class            |
| --------------------------------- | -------------------- | --------------------- |
| Control outbox test               | `@control_silo_test` | `TestCase`            |
| Region outbox test                | `@region_silo_test`  | `TestCase`            |
| Outbox with threading/concurrency | (none)               | `TransactionTestCase` |

## Step 6: Generate Endpoint Silo Tests

Load `references/endpoint-silo-tests.md` for complete templates and patterns.

Endpoint silo tests verify that API endpoints work correctly under their declared silo mode. They must cover:

- **Correct silo decorator**: Match endpoint → test decorator
- **Cross-silo data setup**: Create data using factory methods (no silo wrapper needed)
- **Permission checks**: Verify 401/403 for unauthorized access
- **Response accuracy**: Verify response body matches expected data

### Quick Reference — Decorator Mapping

| Endpoint Decorator                    | Test Decorator                                          |
| ------------------------------------- | ------------------------------------------------------- |
| `@region_silo_endpoint`               | `@region_silo_test`                                     |
| `@control_silo_endpoint`              | `@control_silo_test`                                    |
| `@control_silo_endpoint` (with proxy) | `@control_silo_test(regions=create_test_regions("us"))` |
| No decorator (monolith-only)          | `@no_silo_test`                                         |

## Step 7: Validate

Before presenting the generated test, verify against this checklist:

- [ ] Correct silo decorator on test class
- [ ] `assume_test_silo_mode_of(Model)` for single-model ORM access; `assume_test_silo_mode(SiloMode.X)` for multi-model/non-model ORM blocks
- [ ] Factory methods (`self.create_*`) are NEVER wrapped in `assume_test_silo_mode`
- [ ] Factory methods used — never `Model.objects.create()`
- [ ] `pytest`-style assertions only (`assert x == y`)
- [ ] Correct base class (`TestCase` for most tests; `TransactionTestCase` only for threading/concurrency)
- [ ] Imports are correct and minimal
- [ ] Test file at correct mirror path
- [ ] Test methods have descriptive names (`test_<action>_<scenario>`)
- [ ] Run command: `pytest -svv --reuse-db tests/sentry/path/to/test_file.py`

## Key Imports Quick Reference

```python
# Silo decorators
from sentry.testutils.silo import (
    all_silo_test,
    control_silo_test,
    region_silo_test,
    no_silo_test,
    assume_test_silo_mode,
    assume_test_silo_mode_of,
    create_test_regions,
)

# Base classes
from sentry.testutils.cases import TestCase, TransactionTestCase, APITestCase

# Cross-silo utilities
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.silo.base import SiloMode

# RPC testing
from sentry.hybridcloud.rpc.service import dispatch_to_local_service

# API gateway testing
from sentry.testutils.helpers.apigateway import ApiGatewayTestCase, verify_request_params

# Outbox models
from sentry.hybridcloud.models.outbox import ControlOutbox, RegionOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
```

## Context Manager Quick Reference

```python
# Use ONLY for direct ORM queries — never for factory calls
assume_test_silo_mode(SiloMode.CONTROL)     # Switch to control silo for ORM access
assume_test_silo_mode(SiloMode.REGION)       # Switch to region silo for ORM access
assume_test_silo_mode_of(ModelClass)         # Switch to silo matching model's silo mode

outbox_runner()                               # Drain all pending outboxes on exit
outbox_context(flush=False)                   # Create outboxes without flushing
override_regions(regions)                     # Override active region config
override_settings(SILO_MODE=SiloMode.X)      # Override Django settings
override_options({"key": value})              # Override Sentry options
```
