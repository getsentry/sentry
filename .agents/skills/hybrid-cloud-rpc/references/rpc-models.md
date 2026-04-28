# RPC Models

RPC models are Pydantic `BaseModel` subclasses inheriting from `RpcModel` (defined in `src/sentry/hybridcloud/rpc/__init__.py`). They are the serialization contract between silos.

## Supported Types

| Type                | Default value                 | Notes                                |
| ------------------- | ----------------------------- | ------------------------------------ |
| `int`               | `0` or `-1`                   |                                      |
| `str`               | `""`                          |                                      |
| `bool`              | `False` / `True`              |                                      |
| `float`             | `0.0`                         |                                      |
| `int \| None`       | `None`                        |                                      |
| `str \| None`       | `None`                        |                                      |
| `list[T]`           | `Field(default_factory=list)` | T must be serializable               |
| `dict[str, T]`      | `Field(default_factory=dict)` | Keys must be `str`                   |
| `RpcModel` subclass | Nested model instance         |                                      |
| `Enum` subclass     | Enum member                   | Set `use_enum_values = True`         |
| `datetime.datetime` | `DEFAULT_DATE`                | Import from `sentry.hybridcloud.rpc` |

### Unsupported (will break serialization)

`set`, `frozenset`, `tuple`, `bytes`, Django model instances, `Any`, forward reference strings, types from `from __future__ import annotations`.

## Model Template

```python
# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
import datetime
from typing import Any

from pydantic import Field

from sentry.hybridcloud.rpc import DEFAULT_DATE, RpcModel


class RpcMyThing(RpcModel):
    id: int = -1
    name: str = ""
    tags: list[str] = Field(default_factory=list)
    config: dict[str, Any] = Field(repr=False, default_factory=dict)
    secret_token: str = Field(repr=False, default="")
    date_added: datetime.datetime = DEFAULT_DATE
    parent_id: int | None = None

    class Config:
        orm_mode = True
        use_enum_values = True
```

## Hiding Sensitive Fields with `repr=False`

Use `Field(repr=False)` on any field that contains sensitive, bulky, or opaque data. This prevents the value from appearing in `repr()` output, log messages, Sentry breadcrumbs, and tracebacks.

### When to use `repr=False`

| Field type                  | Examples                                           | Why hide it                                   |
| --------------------------- | -------------------------------------------------- | --------------------------------------------- |
| **Secrets & credentials**   | tokens, hashed passwords, API keys, client secrets | Prevents leaking secrets into logs            |
| **Opaque blobs**            | `config`, `metadata`, `extra_data` dicts           | Noisy in logs, may contain PII or credentials |
| **Session/auth material**   | session nonces, OAuth tokens                       | Security-sensitive                            |
| **Request/response bodies** | headers, payloads                                  | May contain auth headers or PII               |

### Real examples from the codebase

```python
# Tokens and secrets — always hide
token_hashed: str = Field(repr=False, default="")          # orgauthtoken/model.py
client_id: str = Field(repr=False, default="")              # app/model.py
client_secret: str = Field(repr=False, default="")          # app/model.py
session_nonce: str | None = Field(repr=False, default=None) # user/model.py
hash: str = Field(repr=False, default="")                   # lost_password_hash/model.py
token: str = Field(repr=False, default="")                  # auth/model.py
key: str = Field(repr=False, default="")                    # auth/model.py

# Opaque config/metadata — hide to reduce noise and avoid hidden PII
config: Any = Field(repr=False, default=None)               # user/model.py
metadata: dict[str, Any] = Field(repr=False)                # integration/model.py
extra_data: dict[str, Any] = Field(repr=False)              # usersocialauth/model.py
config: dict[str, Any] = Field(repr=False)                  # repository/model.py

# Request/response data — may contain auth headers
request_headers: Mapping[str, str] | None = Field(repr=False, default=None)
```

### Syntax

```python
from pydantic import Field

# With a default value
secret: str = Field(repr=False, default="")

# With a factory default
metadata: dict[str, Any] = Field(repr=False, default_factory=dict)

# Without a default (required field) — less common in RPC models
external_id: str = Field(repr=False)
```

### Rule of thumb

If the field name contains any of these words, use `repr=False`: `token`, `secret`, `key`, `hash`, `password`, `nonce`, `credential`, `config`, `metadata`, `extra_data`, `headers`.

## Serialization Methods

### `serialize_by_field_name` (preferred)

Automatically maps fields by name from the source object:

```python
def serialize_thing(obj: Thing) -> RpcThing:
    return RpcThing.serialize_by_field_name(obj)
```

### With `name_transform`

When ORM field names differ from RPC field names:

```python
RpcThing.serialize_by_field_name(
    obj,
    name_transform=lambda n: f"org_{n}" if n == "id" else n,
)
```

### With `value_transform`

When values need conversion:

```python
RpcThing.serialize_by_field_name(
    obj,
    value_transform=lambda v: v.value if isinstance(v, Enum) else v,
)
```

### Manual construction

When the mapping is complex or involves computed fields:

```python
def serialize_thing(obj: Thing) -> RpcThing:
    return RpcThing(
        id=obj.id,
        name=obj.name,
        is_active=obj.flags.is_active,
    )
```

## Common Pitfalls

1. **Missing defaults**: Every RpcModel field MUST have a default. Pydantic requires this for deserialization when fields are added later.

2. **`from __future__ import annotations`**: Converts all annotations to strings, breaking Pydantic reflection. Never use in model files.

3. **Mutable defaults**: Use `Field(default_factory=list)` not `= []` for list/dict defaults.

4. **Enum fields**: Declare field type as `int` (or `str`) and set `use_enum_values = True` in Config. Use the enum member as the default.

5. **Nested RpcModels**: Automatically serialized. Ensure nested models also have proper defaults.

6. **Read vs Write models**: Use separate models for read responses (`RpcMyThing`) and write payloads (`RpcMyThingUpdate`). Write models contain only mutable fields.

7. **Forgetting `repr=False`**: Sensitive fields without `repr=False` will appear in logs and error reports. Always audit new fields for sensitivity.
