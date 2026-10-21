from datetime import datetime
from typing import Any

from django.db.models import Q, QuerySet

from sentry.api.paginator import BadPaginationError
from sentry.utils.cursors import Cursor, CursorResult, StringCursor


class InboxPaginator:
    """Page by timestamp and ID, including when timestamps are equal."""

    def __init__(self, queryset: QuerySet[Any], order_by: str) -> None:
        self.queryset = queryset
        self.key = order_by.removeprefix("-")

    def get_result(
        self, limit: int = 100, cursor: Cursor | None = None, **kwargs: Any
    ) -> CursorResult[Any]:
        if cursor is None:
            cursor = StringCursor("0")
        if cursor.offset != 0:
            raise BadPaginationError("Invalid inbox cursor.")
        queryset = self.queryset
        has_cursor = cursor.value != "0"
        if has_cursor:
            try:
                timestamp, item_id = str(cursor.value).rsplit("|", 1)
                boundary_time = datetime.fromisoformat(timestamp)
                boundary_id = int(item_id)
            except ValueError:
                raise BadPaginationError("Invalid inbox cursor.")
            comparison = "gt" if cursor.is_prev else "lt"
            queryset = queryset.filter(
                Q(**{f"{self.key}__{comparison}": boundary_time})
                | Q(**{self.key: boundary_time, f"id__{comparison}": boundary_id})
            )
        prefix = "" if cursor.is_prev else "-"
        rows = list(queryset.order_by(f"{prefix}{self.key}", f"{prefix}id")[: limit + 1])
        has_more = len(rows) > limit
        rows = rows[:limit]
        if cursor.is_prev:
            rows.reverse()
        next_value = (
            f"{getattr(rows[-1], self.key).isoformat()}|{rows[-1].id}"
            if rows
            else str(cursor.value)
        )
        prev_value = (
            f"{getattr(rows[0], self.key).isoformat()}|{rows[0].id}" if rows else str(cursor.value)
        )
        return CursorResult(
            results=rows,
            next=StringCursor(next_value, has_results=has_cursor if cursor.is_prev else has_more),
            prev=StringCursor(
                prev_value, is_prev=True, has_results=has_more if cursor.is_prev else has_cursor
            ),
        )
