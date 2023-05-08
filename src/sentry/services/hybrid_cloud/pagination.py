# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.


from typing import TYPE_CHECKING, Any, List, Optional, Type

import sentry_sdk
from pydantic.fields import Field
from rest_framework.request import Request

from sentry.services.hybrid_cloud import RpcModel
from sentry.utils.cursors import Cursor, CursorResult
from sentry.utils.pagination_factory import (
    PaginatorLike,
    annotate_span_with_pagination_args,
    get_cursor,
    get_paginator,
)

if TYPE_CHECKING:
    from sentry.api.base import Endpoint


class RpcPaginationArgs(RpcModel):
    encoded_cursor: Optional[str] = None
    per_page: int = -1

    @classmethod
    def from_endpoint_request(cls, e: "Endpoint", request: Request) -> "RpcPaginationArgs":
        return RpcPaginationArgs(
            encoded_cursor=request.GET.get(e.cursor_name), per_page=e.get_per_page(request)
        )

    def do_hybrid_cloud_pagination(
        self,
        *,
        description: str,
        paginator_cls: Type[PaginatorLike],
        order_by: str,
        queryset: Any,
        cursor_cls: Type[Cursor] = Cursor,
        count_hits: Optional[bool] = None,
    ) -> "RpcPaginationResult":
        cursor = get_cursor(self.encoded_cursor, cursor_cls)
        with sentry_sdk.start_span(
            op="hybrid_cloud.paginate.get_result",
            description=description,
        ) as span:
            annotate_span_with_pagination_args(span, self.per_page)
            paginator = get_paginator(
                None, paginator_cls, dict(order_by=order_by, queryset=queryset.values("id"))
            )
            extra_args: Any = {}
            if count_hits is not None:
                extra_args["count_hits"] = count_hits

            return RpcPaginationResult.from_cursor_result(
                paginator.get_result(limit=self.per_page, cursor=cursor, **extra_args)
            )


class RpcCursorState(RpcModel):
    encoded: str = ""
    has_results: Optional[bool] = None

    @classmethod
    def from_cursor(cls, cursor: Cursor) -> "RpcCursorState":
        return RpcCursorState(encoded=str(cursor), has_results=cursor.has_results)

    # Rpc Compatibility with Cursor
    def __str__(self) -> str:
        return self.encoded

    def __bool__(self) -> bool:
        return bool(self.has_results)


class RpcPaginationResult(RpcModel):
    ids: List[int] = Field(default_factory=list)
    hits: Optional[int] = None
    max_hits: Optional[int] = None
    next: RpcCursorState = Field(default_factory=lambda: RpcCursorState())
    prev: RpcCursorState = Field(default_factory=lambda: RpcCursorState())

    @classmethod
    def from_cursor_result(cls, cursor_result: CursorResult[Any]) -> "RpcPaginationResult":
        return RpcPaginationResult(
            ids=[row["id"] for row in cursor_result.results],
            hits=cursor_result.hits,
            max_hits=cursor_result.max_hits,
            next=RpcCursorState.from_cursor(cursor_result.next),
            prev=RpcCursorState.from_cursor(cursor_result.prev),
        )
