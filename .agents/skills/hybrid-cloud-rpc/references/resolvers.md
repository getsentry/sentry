# Cell Resolution Strategies

Cell-silo services (`local_mode = SiloMode.CELL`) require every RPC method to declare how to resolve the target cell from the method's arguments. This is done via the `resolve` parameter on `@cell_rpc_method`.

All resolvers are defined in `src/sentry/hybridcloud/rpc/resolvers.py`.

## Resolver Table

| Resolver                    | Resolves by                                        | Default `parameter_name` | Use when                                      |
| --------------------------- | -------------------------------------------------- | ------------------------ | --------------------------------------------- |
| `ByOrganizationId`          | Organization ID → cell via `OrganizationMapping`   | `"organization_id"`      | Method takes an `organization_id: int` param  |
| `ByOrganizationSlug`        | Organization slug → cell via `OrganizationMapping` | `"slug"`                 | Method takes a `slug: str` param              |
| `ByOrganizationIdAttribute` | Attribute of an RpcModel param → org ID → cell     | _(required)_             | Method takes an RpcModel with an org ID field |
| `ByCellName`                | Cell name string → cell                            | `"cell_name"`            | Caller already knows the cell name            |
| `RequireSingleOrganization` | Single-org environments only                       | _(none)_                 | Method works only in single-org mode          |

## Usage Examples

### ByOrganizationId (most common)

```python
# Uses default parameter_name="organization_id"
@cell_rpc_method(resolve=ByOrganizationId())
@abstractmethod
def get_thing(self, *, organization_id: int, id: int) -> RpcThing | None:
    pass

# Custom parameter name
@cell_rpc_method(resolve=ByOrganizationId("id"))
@abstractmethod
def serialize_organization(self, *, id: int) -> Any | None:
    pass
```

### ByOrganizationSlug

```python
# Uses default parameter_name="slug"
@cell_rpc_method(resolve=ByOrganizationSlug())
@abstractmethod
def get_org_by_slug(self, *, slug: str) -> RpcOrgSummary | None:
    pass
```

### ByOrganizationIdAttribute

Resolves the cell from an attribute of an RpcModel parameter. Useful when the organization ID is embedded in a request object.

```python
# parameter_name is required — it names the method parameter
# attribute_name defaults to "organization_id"
@cell_rpc_method(resolve=ByOrganizationIdAttribute("organization_member"))
@abstractmethod
def update_membership_flags(self, *, organization_member: RpcOrganizationMember) -> None:
    pass
```

In this example, the framework calls `arguments["organization_member"].organization_id` to get the org ID for cell lookup.

To use a different attribute:

```python
@cell_rpc_method(
    resolve=ByOrganizationIdAttribute("request", attribute_name="org_id")
)
@abstractmethod
def process_request(self, *, request: RpcMyRequest) -> None:
    pass
```

### ByCellName

```python
# Uses default parameter_name="cell_name"
@cell_rpc_method(resolve=ByCellName())
@abstractmethod
def update_cell_user(self, *, user: RpcCellUser, cell_name: str) -> None:
    pass
```

### RequireSingleOrganization

```python
@cell_rpc_method(resolve=RequireSingleOrganization())
@abstractmethod
def get_default_organization(self) -> RpcOrganization:
    pass
```

This resolver raises `CellResolutionError` if the environment is not configured for single-organization mode.

## `return_none_if_mapping_not_found`

When a method has an `Optional` return type and a missing organization mapping means "not found" rather than an error, set this flag:

```python
@cell_rpc_method(resolve=ByOrganizationId("id"), return_none_if_mapping_not_found=True)
@abstractmethod
def get_organization_by_id(self, *, id: int) -> RpcOrganization | None:
    pass
```

Without this flag, a missing `OrganizationMapping` raises `CellMappingNotFound`. With it, the method returns `None` instead.

**Use when**: The method is a lookup that should gracefully handle deleted/unmapped orgs.
**Do NOT use when**: A missing mapping indicates a bug or data integrity issue.

## Choosing a Resolver

Decision tree:

1. Does the method take `organization_id: int` directly? → `ByOrganizationId()`
2. Does the method take `slug: str`? → `ByOrganizationSlug()`
3. Does the method take an RpcModel that has `organization_id`? → `ByOrganizationIdAttribute("param_name")`
4. Does the caller already know the cell name? → `ByCellName()`
5. Is it a single-org-only operation? → `RequireSingleOrganization()`
