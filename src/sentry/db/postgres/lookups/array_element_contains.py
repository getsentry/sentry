from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.models import Lookup
from django.db.models.sql.compiler import SQLCompiler

__all__ = ["ArrayElementContainsLookup"]


class ArrayElementContainsLookup(Lookup):
    lookup_name = "element_contains"

    def as_sql(
        self, compiler: SQLCompiler, connection: BaseDatabaseWrapper
    ) -> tuple[str, list[int | str]]:
        """
        Custom lookup for checking if an element of the array contains a value.
        """

        lhs, lhs_params = self.process_lhs(compiler, connection)
        rhs, rhs_params = self.process_rhs(compiler, connection)
        params = lhs_params + rhs_params

        clause = f"""\
EXISTS (
    SELECT * FROM UNNEST({lhs}) AS elem
    WHERE elem LIKE '%%' || {rhs} || '%%'
)
"""
        return clause, params
