from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Union

from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project


# TODO: lift out types in `types.py` once endpoint is finished.
class FormulaOrder(Enum):
    ASC = "asc"
    DESC = "desc"

    @classmethod
    # Used `Union` because `|` conflicts with the parser.
    def from_string(cls, value: str) -> Union["FormulaOrder", None]:
        for v in cls:
            if v.value == value:
                return v

        return None


@dataclass(frozen=True)
class FormulaDefinition:
    mql: str
    order: FormulaOrder | None
    limit: int | None


class MetricsQueriesPlan:
    def __init__(self):
        self._queries: dict[str, str] = {}
        self._formulas: list[FormulaDefinition] = []

    def declare_query(self, name: str, mql: str) -> "MetricsQueriesPlan":
        self._queries[name] = mql
        return self

    def apply_formula(
        self, mql: str, order: FormulaOrder | None = None, limit: int | None = None
    ) -> "MetricsQueriesPlan":
        self._formulas.append(FormulaDefinition(mql=mql, order=order, limit=limit))
        return self


def run_metrics_queries_plan(
    metrics_queries_plan: MetricsQueriesPlan,
    start: datetime,
    end: datetime,
    interval: int,
    organization: Organization,
    projects: Sequence[Project],
    environments: Sequence[Environment],
    referrer: str,
):
    # TODO: implement new querying logic.
    return None
