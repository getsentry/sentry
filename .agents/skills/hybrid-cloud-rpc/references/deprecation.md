# Deprecating and Removing RPC Methods

Removing an RPC method or service requires a 3-phase approach to avoid breaking cross-silo calls during deployment windows where silos may be running different code versions.

## Phase 1: Disable at Runtime

Use the `hybrid_cloud.rpc.disabled-service-methods` option to disable the method without removing code. This allows instant rollback.

```python
# In Sentry options (or via the admin panel):
# Add "ServiceName.method_name" to the disabled list
options.set("hybrid_cloud.rpc.disabled-service-methods", [
    "MyService.old_method",
])
```

When a disabled method is called remotely, it raises `RpcDisabledException` instead of making a network call. This is checked in `_RemoteSiloCall._check_disabled()`.

### Runtime control options

| Option key                                  | Type               | Purpose                                                         |
| ------------------------------------------- | ------------------ | --------------------------------------------------------------- |
| `hybrid_cloud.rpc.disabled-service-methods` | `list[str]`        | Disable specific methods (format: `"ServiceName.method_name"`)  |
| `hybridcloud.rpc.retries`                   | `int`              | Global retry count (default: 5)                                 |
| `hybridcloud.rpc.method_retry_overrides`    | `dict[str, int]`   | Per-method retry overrides (key: `"service_key.method_name"`)   |
| `hybridcloud.rpc.method_timeout_overrides`  | `dict[str, float]` | Per-method timeout overrides (key: `"service_key.method_name"`) |

**Tip**: Before removing a method, set its retries to 0 and timeout to a low value to surface any remaining callers.

## Phase 2: Migrate Callers

1. Search for all callers of the method:

   ```bash
   grep -r "my_service\.old_method" src/ tests/
   ```

2. Update each caller to use the replacement method or inline the logic.

3. If the method is still needed during the transition, keep it implemented but add a deprecation comment:

   ```python
   @regional_rpc_method(resolve=ByOrganizationId())
   @abstractmethod
   def old_method(self, *, organization_id: int) -> RpcThing | None:
       """Deprecated: Use new_method instead. Remove after YYYY-MM-DD."""
       pass
   ```

4. Deploy and verify zero traffic to the disabled method via metrics:
   - Check `hybrid_cloud.dispatch_rpc.response_code` with tag `rpc_method=ServiceName.old_method`
   - Confirm no `RpcDisabledException` errors in Sentry

## Phase 3: Remove Code

Once confirmed that no callers remain:

1. Remove the abstract method from `service.py`
2. Remove the implementation from `impl.py`
3. Remove any RpcModel classes only used by the removed method from `model.py`
4. Remove serialization helpers from `serial.py` if now unused
5. Remove the method from the `hybrid_cloud.rpc.disabled-service-methods` option
6. Remove any related tests

### Removing an entire service

If removing all methods from a service:

1. Complete Phase 1-3 for every method
2. Remove the `create_delegation()` call
3. Remove the service class
4. Remove the entire service directory
5. The service will automatically disappear from the registry since `list_all_service_method_signatures()` discovers via `pkgutil.walk_packages`

## Safe Removal Checklist

- [ ] Method disabled via `hybrid_cloud.rpc.disabled-service-methods` in production
- [ ] Zero traffic confirmed via metrics for at least 1 week
- [ ] All callers migrated (grep confirms no references)
- [ ] Tests updated or removed
- [ ] RpcModel classes cleaned up if no longer used
- [ ] Option entry removed from disabled list after code removal
