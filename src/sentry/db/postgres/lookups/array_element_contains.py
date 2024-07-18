from typing import Any

from django.contrib.postgres.fields import ArrayField
from django.db.models import Lookup


class ArrayElementContains(Lookup):
    lookup_name = "element_contains"

    def as_sql(self, compiler: Any, connection: Any) -> Any:
        lhs, lhs_params = self.process_lhs(compiler, connection)
        rhs, rhs_params = self.process_rhs(compiler, connection)
        params = lhs_params + rhs_params

        return (
            """EXISTS (
            SELECT * FROM UNNEST({}) AS elem
            WHERE elem LIKE '%%' || {} || '%%'
        )""".format(
                lhs, rhs
            ),
            params,
        )


ArrayField.register_lookup(ArrayElementContains)
