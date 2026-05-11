from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from django.db.models import Q, QuerySet
from django.db.models.functions import TruncSecond
from rest_framework.exceptions import ParseError

from sentry.utils import json

_TRUNC_ANNOTATION = "_synapse_ts_trunc"


@dataclass(frozen=True)
class Cursor:
    # seconds since 1970-01-01 00:00:00 UTC
    updated_at: int
    id: int

    @classmethod
    def decode(cls, cursor_str: str) -> Cursor:
        try:
            decoded = json.loads(base64.b64decode(cursor_str).decode("utf-8"))
            return cls(updated_at=int(decoded["updated_at"]), id=int(decoded["id"]))
        except (ValueError, KeyError, TypeError):
            raise ParseError(detail="Invalid cursor")

    def encode(self) -> str:
        return base64.b64encode(
            json.dumps(
                {
                    "id": str(self.id),
                    "updated_at": self.updated_at,
                }
            ).encode("utf-8")
        ).decode("utf-8")


@dataclass(frozen=True)
class SynapsePage:
    results: list[Any]
    next_cursor: str | None
    has_more: bool


class SynapsePaginator:
    """
    Cursor paginator for Synapse endpoints.

    Uses base64-encoded JSON cursors of the form {"id": integer, "updated_at": integer_seconds}.
    Results are ordered by (timestamp_field truncated to seconds, id_field) ascending. The cursor
    points to the last returned item; the next page starts strictly after it via
    (trunc(timestamp) > T) OR (trunc(timestamp) = T AND id > cursor_id).
    """

    def __init__(
        self,
        queryset: QuerySet,
        id_field: str,
        timestamp_field: str,
    ) -> None:
        # Synapse cursors carry timestamps as integer seconds, but the DB column may store
        # sub-second precision. Without truncation, a cursor built from T+0.5s reconstructs
        # as T+0.0s, causing records within the same second to appear on multiple pages.
        # Truncating to seconds here keeps ordering and filtering consistent with the cursor.
        self.queryset = queryset.annotate(
            **{_TRUNC_ANNOTATION: TruncSecond(timestamp_field)}
        ).order_by(_TRUNC_ANNOTATION, id_field)
        self.id_field = id_field
        self.timestamp_field = timestamp_field

    def get_result(self, limit: int, cursor_str: str | None) -> SynapsePage:
        query = self.queryset

        if cursor_str:
            cursor = Cursor.decode(cursor_str)
            cursor_dt = datetime.fromtimestamp(cursor.updated_at, tz=timezone.utc)

            # Equivalent to (trunc(ts), id) > (cursor_ts, cursor_id): expanded to two OR
            # conditions for the django ORM.
            query = query.filter(
                Q(**{f"{_TRUNC_ANNOTATION}__gt": cursor_dt})
                | Q(
                    **{
                        _TRUNC_ANNOTATION: cursor_dt,
                        f"{self.id_field}__gt": cursor.id,
                    }
                )
            )

        # Use limit + 1 fetch to determine if there's another page
        results = list(query[: limit + 1])
        has_more = len(results) > limit
        results = results[:limit]

        next_cursor = (
            Cursor(
                updated_at=int(getattr(results[-1], _TRUNC_ANNOTATION).timestamp()),
                id=int(getattr(results[-1], self.id_field)),
            ).encode()
            if results
            else None
        )

        return SynapsePage(results=results, next_cursor=next_cursor, has_more=has_more)
