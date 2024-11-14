from __future__ import annotations

from django.db import connections, router


class AnalyzeQuery:
    def __init__(self, model):
        self.model = model
        self.using = router.db_for_write(model)

    def execute(self):
        query = """
            analyze {table};
        """.format(
            table=self.model._meta.db_table,
        )

        return connections[self.using].cursor().execute(query)
