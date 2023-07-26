from __future__ import annotations

from typing import Any

from django.db import models
from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.models import ForeignKey

__all__ = ("FlexibleForeignKey",)


class FlexibleForeignKey(ForeignKey):
    def __init__(self, *args: Any, **kwargs: Any):
        kwargs.setdefault("on_delete", models.CASCADE)
        super().__init__(*args, **kwargs)

    def db_type(self, connection: BaseDatabaseWrapper) -> str | None:
        # This is required to support BigAutoField (or anything similar)
        rel_field = self.target_field
        if hasattr(rel_field, "get_related_db_type"):
            return rel_field.get_related_db_type(connection)
        return super().db_type(connection)
