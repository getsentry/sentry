from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sentry.utils.services import Service

ANY = object()

if TYPE_CHECKING:
    from sentry.api.event_search import SearchFilter
    from sentry.models.environment import Environment
    from sentry.models.group import Group
    from sentry.models.project import Project
    from sentry.search.snuba.executors import TrendsSortWeights
    from sentry.utils.cursors import Cursor, CursorResult


class SearchBackend(Service):
    __read_methods__ = ("query",)
    __write_methods__ = ()
    __all__ = tuple(set(__read_methods__ + __write_methods__))

    def __init__(self, **options: Mapping[str, Any] | None):
        pass

    def query(
        self,
        projects: Sequence[Project],
        environments: Sequence[Environment] | None = None,
        sort_by: str = "date",
        limit: int = 100,
        cursor: Cursor | None = None,
        count_hits: bool = False,
        paginator_options: Mapping[str, Any] | None = None,
        search_filters: Sequence[SearchFilter] | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        max_hits: int | None = None,
        referrer: str | None = None,
        actor: Any | None = None,
        aggregate_kwargs: TrendsSortWeights | None = None,
    ) -> CursorResult[Group]:
        raise NotImplementedError
