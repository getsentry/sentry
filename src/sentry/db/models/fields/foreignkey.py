from typing import cast

from django.db import models
from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.models import ForeignKey

from sentry.utils.types import Any

__all__ = ("FlexibleForeignKey",)


class FlexibleForeignKey(ForeignKey):  # type: ignore
    def __init__(self, *args: Any, **kwargs: Any):
        kwargs.setdefault("on_delete", models.CASCADE)
        super().__init__(*args, **kwargs)

    def db_type(self, connection: BaseDatabaseWrapper) -> str:
        # This is required to support BigAutoField (or anything similar)
        rel_field = self.target_field
        if hasattr(rel_field, "get_related_db_type"):
            return cast(str, rel_field.get_related_db_type(connection))
        return cast(str, super().db_type(connection))
