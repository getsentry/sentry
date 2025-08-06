from collections.abc import Callable

from sentry.replays.usecases.query import QueryResponse
from sentry.utils.cursors import Cursor, CursorResult


class HasMorePaginator:
    """Returns a next cursor if the limit plus one was met."""

    def __init__(self, data_fn: Callable[[int, int], QueryResponse]) -> None:
        self.data_fn = data_fn

    def get_result(self, limit: int, cursor=None):
        assert limit > 0
        offset = int(cursor.offset) if cursor is not None else 0
        response = self.data_fn(offset, limit + 1)

        return CursorResult(
            response.response,
            prev=Cursor(0, max(0, offset - limit), True, offset > 0),
            next=Cursor(0, max(0, offset + limit), False, response.has_more),
        )
