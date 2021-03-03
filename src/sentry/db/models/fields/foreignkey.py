from django.db import models
from django.db.models import ForeignKey

__all__ = ("FlexibleForeignKey",)


class FlexibleForeignKey(ForeignKey):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("on_delete", models.CASCADE)
        return super().__init__(*args, **kwargs)

    def db_type(self, connection):
        # This is required to support BigAutoField (or anything similar)
        rel_field = self.target_field
        if hasattr(rel_field, "get_related_db_type"):
            return rel_field.get_related_db_type(connection)
        return super().db_type(connection)
