from datetime import UTC, datetime, timedelta
from typing import Any

from django.db.models import Q, QuerySet

from sentry.api.paginator import BadPaginationError
from sentry.utils.cursors import Cursor, CursorResult, StringCursor

_EPOCH = datetime(1970, 1, 1, tzinfo=UTC)


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
        cursor_value = str(cursor.value)
        has_cursor = cursor_value != "0"
        if has_cursor:
            try:
                timestamp, item_id = cursor_value.split("_")
                microseconds = int(timestamp)
                boundary_time = _EPOCH + timedelta(microseconds=microseconds)
                boundary_id = int(item_id)
            except (ValueError, OverflowError):
                raise BadPaginationError("Invalid inbox cursor.")
            cursor_value = f"{microseconds}_{boundary_id}"
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
        next_value = self._cursor_value(rows[-1]) if rows else cursor_value
        prev_value = self._cursor_value(rows[0]) if rows else cursor_value
        return CursorResult(
            results=rows,
            next=StringCursor(next_value, has_results=has_cursor if cursor.is_prev else has_more),
            prev=StringCursor(
                prev_value, is_prev=True, has_results=has_more if cursor.is_prev else has_cursor
            ),
        )

    def _cursor_value(self, item: Any) -> str:
        microseconds = (getattr(item, self.key) - _EPOCH) // timedelta(microseconds=1)
        return f"{microseconds}_{item.id}"
