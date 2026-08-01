from __future__ import annotations

from typing import Any
from uuid import uuid4


class RegenerateInvestigationUUIDsOnRelocationMixin:
    """Keep organization relocation imports from colliding with source UUIDs."""

    __relocation_uuid_fields__: tuple[str, ...] = ("uuid",)

    def normalize_before_relocation_import(self, pk_map: Any, scope: Any, flags: Any) -> int | None:
        old_pk = super().normalize_before_relocation_import(pk_map, scope, flags)  # type: ignore[misc]
        if old_pk is None:
            return None

        for field in self.__relocation_uuid_fields__:
            setattr(self, field, uuid4())

        return old_pk
