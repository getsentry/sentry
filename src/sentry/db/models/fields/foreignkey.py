from __future__ import absolute_import

from django.db.models import ForeignKey

__all__ = ("FlexibleForeignKey",)


class FlexibleForeignKey(ForeignKey):
    def db_type(self, connection):
        # This is required to support BigAutoField (or anything similar)
        rel_field = self.target_field
        if hasattr(rel_field, "get_related_db_type"):
            return rel_field.get_related_db_type(connection)
        return super(FlexibleForeignKey, self).db_type(connection)
