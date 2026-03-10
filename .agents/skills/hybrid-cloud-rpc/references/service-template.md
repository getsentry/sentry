# RPC Service File Templates

## `__init__.py`

```python
from .model import *  # noqa
from .service import *  # noqa
```

## `model.py` (REGION silo example)

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
    id: int = 0
    organization_id: int = 0
    name: str = ""
    is_active: bool = True
    # Use repr=False for opaque blobs and sensitive data to prevent log leakage
    config: dict[str, Any] = Field(repr=False, default_factory=dict)
    date_added: datetime.datetime = DEFAULT_DATE

    class Config:
        orm_mode = True
        use_enum_values = True


class RpcMyThingUpdate(RpcModel):
    """Write model for updates — only include mutable fields."""
    name: str = ""
    is_active: bool = True
```

## `model.py` (CONTROL silo example)

```python
# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import datetime

from pydantic import Field

from sentry.hybridcloud.rpc import DEFAULT_DATE, RpcModel


class RpcMyMapping(RpcModel):
    id: int = 0
    user_id: int | None = None
    organization_id: int = 0
    role: str = ""
    email: str | None = None
    # Use repr=False for tokens, secrets, and credentials
    token: str = Field(repr=False, default="")
    date_added: datetime.datetime = DEFAULT_DATE

    class Config:
        orm_mode = True
        use_enum_values = True
```

## `serial.py`

```python
from __future__ import annotations

from sentry.myapp.models import MyThing
from sentry.mydomain.services.mything.model import RpcMyThing


def serialize_my_thing(obj: MyThing) -> RpcMyThing:
    return RpcMyThing.serialize_by_field_name(obj)
```

### With `name_transform`

Use when the ORM field name differs from the RPC model field name:

```python
def serialize_my_thing(obj: MyThing) -> RpcMyThing:
    return RpcMyThing.serialize_by_field_name(
        obj,
        name_transform=lambda n: f"thing_{n}" if n == "id" else n,
    )
```

### With `value_transform`

Use when values need conversion (e.g., enum to int):

```python
def serialize_my_thing(obj: MyThing) -> RpcMyThing:
    return RpcMyThing.serialize_by_field_name(
        obj,
        value_transform=lambda v: v.value if hasattr(v, "value") else v,
    )
```

### Manual serialization

Use when the mapping is complex:

```python
def serialize_my_thing(obj: MyThing) -> RpcMyThing:
    return RpcMyThing(
        id=obj.id,
        organization_id=obj.organization_id,
        name=obj.name,
        is_active=obj.flags.is_active,
        date_added=obj.date_added,
    )
```

## `service.py` (REGION silo)

```python
# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
from abc import abstractmethod

from sentry.hybridcloud.rpc.resolvers import ByOrganizationId
from sentry.hybridcloud.rpc.service import RpcService, regional_rpc_method
from sentry.mydomain.services.mything.model import RpcMyThing, RpcMyThingUpdate
from sentry.silo.base import SiloMode


class MyThingService(RpcService):
    key = "my_thing"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.mydomain.services.mything.impl import DatabaseBackedMyThingService

        return DatabaseBackedMyThingService()

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_by_id(
        self,
        *,
        organization_id: int,
        id: int,
    ) -> RpcMyThing | None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def update(
        self,
        *,
        organization_id: int,
        id: int,
        attrs: RpcMyThingUpdate,
    ) -> RpcMyThing | None:
        pass


my_thing_service = MyThingService.create_delegation()
```

## `service.py` (CONTROL silo)

```python
# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
from abc import abstractmethod

from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.mydomain.services.mymapping.model import RpcMyMapping
from sentry.silo.base import SiloMode


class MyMappingService(RpcService):
    key = "my_mapping"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.mydomain.services.mymapping.impl import DatabaseBackedMyMappingService

        return DatabaseBackedMyMappingService()

    @rpc_method
    @abstractmethod
    def get_by_user(
        self,
        *,
        user_id: int,
    ) -> list[RpcMyMapping]:
        pass

    @rpc_method
    @abstractmethod
    def upsert(
        self,
        *,
        organization_id: int,
        user_id: int | None = None,
        role: str = "",
    ) -> RpcMyMapping:
        pass


my_mapping_service = MyMappingService.create_delegation()
```

## `impl.py` (REGION silo example)

```python
from __future__ import annotations

from sentry.myapp.models import MyThing
from sentry.mydomain.services.mything.model import RpcMyThing, RpcMyThingUpdate
from sentry.mydomain.services.mything.serial import serialize_my_thing
from sentry.mydomain.services.mything.service import MyThingService


class DatabaseBackedMyThingService(MyThingService):
    def get_by_id(
        self,
        *,
        organization_id: int,
        id: int,
    ) -> RpcMyThing | None:
        try:
            obj = MyThing.objects.get(organization_id=organization_id, id=id)
        except MyThing.DoesNotExist:
            return None
        return serialize_my_thing(obj)

    def update(
        self,
        *,
        organization_id: int,
        id: int,
        attrs: RpcMyThingUpdate,
    ) -> RpcMyThing | None:
        try:
            obj = MyThing.objects.get(organization_id=organization_id, id=id)
        except MyThing.DoesNotExist:
            return None
        obj.name = attrs.name
        obj.is_active = attrs.is_active
        obj.save()
        return serialize_my_thing(obj)
```

## `impl.py` (CONTROL silo example)

```python
from __future__ import annotations

from django.db import IntegrityError, router, transaction

from sentry.myapp.models import MyMapping
from sentry.mydomain.services.mymapping.model import RpcMyMapping
from sentry.mydomain.services.mymapping.serial import serialize_my_mapping
from sentry.mydomain.services.mymapping.service import MyMappingService


class DatabaseBackedMyMappingService(MyMappingService):
    def get_by_user(
        self,
        *,
        user_id: int,
    ) -> list[RpcMyMapping]:
        return [
            serialize_my_mapping(m)
            for m in MyMapping.objects.filter(user_id=user_id)
        ]

    def upsert(
        self,
        *,
        organization_id: int,
        user_id: int | None = None,
        role: str = "",
    ) -> RpcMyMapping:
        with transaction.atomic(router.db_for_write(MyMapping)):
            try:
                mapping, _ = MyMapping.objects.update_or_create(
                    organization_id=organization_id,
                    user_id=user_id,
                    defaults={"role": role},
                )
            except IntegrityError:
                mapping = MyMapping.objects.get(
                    organization_id=organization_id,
                    user_id=user_id,
                )
        return serialize_my_mapping(mapping)
```

## Registered Discovery Packages

The following 12 packages are scanned for RPC services at startup (defined in `src/sentry/hybridcloud/rpc/service.py:list_all_service_method_signatures()`):

1. `sentry.auth.services`
2. `sentry.audit_log.services`
3. `sentry.backup.services`
4. `sentry.hybridcloud.services`
5. `sentry.identity.services`
6. `sentry.integrations.services`
7. `sentry.issues.services`
8. `sentry.notifications.services`
9. `sentry.organizations.services`
10. `sentry.projects.services`
11. `sentry.sentry_apps.services`
12. `sentry.users.services`

Your service's Python package must be a sub-package of one of these for automatic discovery.
