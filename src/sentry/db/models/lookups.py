from django.db.models import CharField, TextField
from django.db.models.lookups import Lookup


class ILike(Lookup):
    """
    PostgreSQL-native ILIKE lookup that generates ``col ILIKE %s``
    instead of Django's default ``UPPER(col) LIKE UPPER(%s)`` from icontains.

    This allows PostgreSQL GIN trigram indexes (pg_trgm) to be used.
    """

    lookup_name = "ilike"

    def as_sql(self, compiler, connection):
        lhs, lhs_params = self.process_lhs(compiler, connection)
        rhs, rhs_params = self.process_rhs(compiler, connection)
        if rhs_params:
            value = rhs_params[0]
            # Escape LIKE-special characters so they match literally
            value = value.replace("\\", "\\\\")
            value = value.replace("%", "\\%")
            value = value.replace("_", "\\_")
            params = [f"%{value}%"]
        else:
            params = rhs_params
        return f"{lhs} ILIKE %s", params


CharField.register_lookup(ILike)
TextField.register_lookup(ILike)
