from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any, Mapping, Optional, Sequence

from sentry.utils.services import Service

ANY = object()

if TYPE_CHECKING:
    from sentry.api.event_search import SearchFilter
    from sentry.models import Environment, Project
    from sentry.utils.cursors import Cursor, CursorResult


class SearchBackend(Service):
    __read_methods__ = ("query",)
    __write_methods__ = ()
    __all__ = tuple(set(__read_methods__ + __write_methods__))

    def __init__(self, **options: Optional[Mapping[str, Any]]):
        pass

    def query(
        self,
        projects: Sequence[Project],
        environments: Optional[Sequence[Environment]] = None,
        sort_by: str = "date",
        limit: int = 100,
        cursor: Optional[Cursor] = None,
        count_hits: bool = False,
        paginator_options: Optional[Mapping[str, Any]] = None,
        search_filters: Optional[Sequence[SearchFilter]] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        max_hits: Optional[int] = None,
    ) -> CursorResult:
        raise NotImplementedError
