from __future__ import annotations

from typing import Any, Mapping, Protocol, Type

import sentry_sdk
from sentry_sdk.tracing import Span

from sentry.utils.cursors import Cursor, CursorResult
from sentry.utils.numbers import format_grouped_length


class PaginatorLike(Protocol):
    def __init__(self, *args: Any, **kwds: Any):
        pass

    def get_result(
        self,
        limit: int = 100,
        cursor: Any = None,
        count_hits: Any = False,
        known_hits: Any = None,
        max_hits: Any = None,
    ) -> CursorResult[Any]:
        pass


def clamp_pagination_per_page(
    requested_per_page: str | int | None, default_per_page: int = 100, max_per_page: int = 100
) -> int:
    if requested_per_page is None:
        requested_per_page = default_per_page

    try:
        per_page = int(requested_per_page)
    except ValueError:
        raise ValueError("Invalid per_page parameter.")

    max_per_page = max(max_per_page, default_per_page)
    if per_page > max_per_page:
        raise ValueError(f"Invalid per_page value. Cannot exceed {max_per_page}.")

    return per_page


def get_cursor(cursor_name: str | None, cursor_cls: Type[Cursor] = Cursor) -> Cursor | None:
    if not cursor_name:
        return None

    try:
        return cursor_cls.from_string(cursor_name)
    except ValueError:
        raise ValueError("Invalid cursor parameter.")


def get_paginator(
    paginator: PaginatorLike | None = None,
    paginator_cls: Type[PaginatorLike] | None = None,
    paginator_kwargs: Mapping[str, Any] | None = None,
) -> PaginatorLike:
    if paginator_cls is None:
        from sentry.api.paginator import Paginator

        paginator_cls = Paginator
    assert (paginator and not paginator_kwargs) or (paginator_cls and paginator_kwargs)
    return paginator or paginator_cls(**(paginator_kwargs or {}))


def annotate_span_with_pagination_args(span: Span, per_page: int) -> None:
    from sentry.utils.sdk import set_measurement

    span.set_data("Limit", per_page)
    set_measurement("query.per_page", per_page)
    sentry_sdk.set_tag("query.per_page", per_page)
    sentry_sdk.set_tag("query.per_page.grouped", format_grouped_length(per_page, [1, 10, 50, 100]))
