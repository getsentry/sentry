from __future__ import annotations

from django.db import connections, router
from django.db.models import Model


class AnalyzeQuery:
    def __init__(self, model: type[Model]) -> None:
        self.model = model
        self.using = router.db_for_write(model)

    def execute(self) -> None:
        query = f"""
            analyze {self.model._meta.db_table};
        """

        connections[self.using].cursor().execute(query)
