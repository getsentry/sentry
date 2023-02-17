from __future__ import annotations

from typing import Any, Protocol, Type, TypeVar

from sentry.services.hybrid_cloud.tombstone import RpcTombstone, tombstone_service


class ModelLike(Protocol):
    objects: Any


T = TypeVar("T", bound=ModelLike)


def maybe_process_tombstone(model: Type[T], object_identifier: int) -> T | None:
    if instance := model.objects.filter(id=object_identifier).last():
        return instance

    tombstone_service.record_remote_tombstone(
        RpcTombstone(table_name=model._meta.db_table, identifier=object_identifier)
    )
    return None
