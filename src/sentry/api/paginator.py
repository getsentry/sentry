from __future__ import absolute_import

import bisect
import functools
import math

from datetime import datetime
from django.db import connections
from django.db.models.sql.datastructures import EmptyResultSet
from django.utils import timezone

from sentry.utils.cursors import build_cursor, Cursor, CursorResult

quote_name = connections["default"].ops.quote_name


MAX_LIMIT = 100
MAX_HITS_LIMIT = 1000


class BadPaginationError(Exception):
    pass


class BasePaginator(object):
    def __init__(self, queryset, order_by=None, max_limit=MAX_LIMIT, on_results=None):
        if order_by:
            if order_by.startswith("-"):
                self.key, self.desc = order_by[1:], True
            else:
                self.key, self.desc = order_by, False
        else:
            self.key = None
            self.desc = False
        self.queryset = queryset
        self.max_limit = max_limit
        self.on_results = on_results

    def _is_asc(self, is_prev):
        return (self.desc and is_prev) or not (self.desc or is_prev)

    def _build_queryset(self, value, is_prev):
        queryset = self.queryset

        # "asc" controls whether or not we need to change the ORDER BY to
        # ascending.  If we're sorting by DESC but we're using a previous
        # page cursor, we'll change the ordering to ASC and reverse the
        # list below (this is so we know how to get the before/after row).
        # If we're sorting ASC _AND_ we're not using a previous page cursor,
        # then we'll need to resume using ASC.
        asc = self._is_asc(is_prev)

        # We need to reverse the ORDER BY if we're using a cursor for a
        # previous page so we know exactly where we ended last page.  The
        # results will get reversed back to the requested order below.
        if self.key:
            if self.key in queryset.query.order_by:
                if not asc:
                    index = queryset.query.order_by.index(self.key)
                    queryset.query.order_by[index] = "-%s" % (queryset.query.order_by[index])
            elif ("-%s" % self.key) in queryset.query.order_by:
                if asc:
                    index = queryset.query.order_by.index("-%s" % (self.key))
                    queryset.query.order_by[index] = queryset.query.order_by[index][1:]
            else:
                if asc:
                    queryset = queryset.order_by(self.key)
                else:
                    queryset = queryset.order_by("-%s" % self.key)

        if value:
            assert self.key
            if self.key in queryset.query.extra:
                col_query, col_params = queryset.query.extra[self.key]
                col_params = col_params[:]
            else:
                col_query, col_params = quote_name(self.key), []
            col_params.append(value)

            if asc:
                queryset = queryset.extra(
                    where=["%s.%s >= %%s" % (queryset.model._meta.db_table, col_query)],
                    params=col_params,
                )
            else:
                queryset = queryset.extra(
                    where=["%s.%s <= %%s" % (queryset.model._meta.db_table, col_query)],
                    params=col_params,
                )

        return queryset

    def get_item_key(self, item, for_prev):
        raise NotImplementedError

    def value_from_cursor(self, cursor):
        raise NotImplementedError

    def get_result(self, limit=100, cursor=None, count_hits=False, known_hits=None):
        # cursors are:
        #   (identifier(integer), row offset, is_prev)
        if cursor is None:
            cursor = Cursor(0, 0, 0)

        limit = min(limit, self.max_limit)

        if cursor.value:
            cursor_value = self.value_from_cursor(cursor)
        else:
            cursor_value = 0

        queryset = self._build_queryset(cursor_value, cursor.is_prev)

        # TODO(dcramer): this does not yet work correctly for ``is_prev`` when
        # the key is not unique
        if count_hits:
            hits = self.count_hits(MAX_HITS_LIMIT)
        elif known_hits is not None:
            hits = known_hits
        else:
            hits = None

        offset = cursor.offset
        # The extra amount is needed so we can decide in the ResultCursor if there is
        # more on the next page.
        extra = 1
        # this effectively gets us the before row, and the current (after) row
        # every time. Do not offset if the provided cursor value was empty since
        # there is nothing to traverse past.
        # We need to actually fetch the before row so that we can compare it to the
        # cursor value. This allows us to handle an edge case where the first row
        # for a given cursor is the same row that generated the cursor on the
        # previous page, but we want to display since it has had its its sort value
        # updated.
        if cursor.is_prev and cursor.value:
            extra += 1

        stop = offset + limit + extra
        results = list(queryset[offset:stop])

        if cursor.is_prev and cursor.value:
            # If the first result is equal to the cursor_value then it's safe to filter
            # it out, since the value hasn't been updated
            if results and self.get_item_key(results[0], for_prev=True) == cursor.value:
                results = results[1:]
            # Otherwise we may have fetched an extra row, just drop it off the end if so.
            elif len(results) == offset + limit + extra:
                results = results[:-1]

        if cursor.is_prev:
            results.reverse()

        return build_cursor(
            results=results,
            limit=limit,
            hits=hits,
            max_hits=MAX_HITS_LIMIT if count_hits else None,
            cursor=cursor,
            is_desc=self.desc,
            key=self.get_item_key,
            on_results=self.on_results,
        )

    def count_hits(self, max_hits):
        if not max_hits:
            return 0
        hits_query = self.queryset.values()[:max_hits].query
        # clear out any select fields (include select_related) and pull just the id
        hits_query.clear_select_clause()
        hits_query.add_fields(["id"])
        hits_query.clear_ordering(force_empty=True)
        try:
            h_sql, h_params = hits_query.sql_with_params()
        except EmptyResultSet:
            return 0
        cursor = connections[self.queryset.db].cursor()
        cursor.execute(u"SELECT COUNT(*) FROM ({}) as t".format(h_sql), h_params)
        return cursor.fetchone()[0]


class Paginator(BasePaginator):
    def get_item_key(self, item, for_prev=False):
        value = getattr(item, self.key)
        return math.floor(value) if self._is_asc(for_prev) else math.ceil(value)

    def value_from_cursor(self, cursor):
        return cursor.value


class DateTimePaginator(BasePaginator):
    multiplier = 1000

    def get_item_key(self, item, for_prev=False):
        value = getattr(item, self.key)
        value = float(value.strftime("%s.%f")) * self.multiplier
        return math.floor(value) if self._is_asc(for_prev) else math.ceil(value)

    def value_from_cursor(self, cursor):
        return datetime.fromtimestamp(float(cursor.value) / self.multiplier).replace(
            tzinfo=timezone.utc
        )


# TODO(dcramer): previous cursors are too complex at the moment for many things
# and are only useful for polling situations. The OffsetPaginator ignores them
# entirely and uses standard paging
class OffsetPaginator(object):
    def __init__(
        self, queryset, order_by=None, max_limit=MAX_LIMIT, max_offset=None, on_results=None
    ):
        self.key = (
            order_by
            if order_by is None or isinstance(order_by, (list, tuple, set))
            else (order_by,)
        )
        self.queryset = queryset
        self.max_limit = max_limit
        self.max_offset = max_offset
        self.on_results = on_results

    def get_result(self, limit=100, cursor=None):
        # offset is page #
        # value is page limit
        if cursor is None:
            cursor = Cursor(0, 0, 0)

        limit = min(limit, self.max_limit)

        queryset = self.queryset
        if self.key:
            queryset = queryset.order_by(*self.key)

        page = cursor.offset
        offset = cursor.offset * cursor.value
        stop = offset + (cursor.value or limit) + 1

        if self.max_offset is not None and offset >= self.max_offset:
            raise BadPaginationError("Pagination offset too large")
        if offset < 0:
            raise BadPaginationError("Pagination offset cannot be negative")

        results = list(queryset[offset:stop])
        if cursor.value != limit:
            results = results[-(limit + 1) :]

        next_cursor = Cursor(limit, page + 1, False, len(results) > limit)
        prev_cursor = Cursor(limit, page - 1, True, page > 0)

        results = list(results[:limit])
        if self.on_results:
            results = self.on_results(results)

        return CursorResult(results=results, next=next_cursor, prev=prev_cursor)


def reverse_bisect_left(a, x, lo=0, hi=None):
    """\
    Similar to ``bisect.bisect_left``, but expects the data in the array ``a``
    to be provided in descending order, rather than the ascending order assumed
    by ``bisect_left``.

    The returned index ``i`` partitions the array ``a`` into two halves so that:

    - left side: ``all(val > x for val in a[lo:i])``
    - right side: ``all(val <= x for val in a[i:hi])``
    """
    if lo < 0:
        raise ValueError("lo must be non-negative")

    if hi is None or hi > len(a):
        hi = len(a)

    while lo < hi:
        mid = (lo + hi) // 2
        if a[mid] > x:
            lo = mid + 1
        else:
            hi = mid

    return lo


class SequencePaginator(object):
    def __init__(self, data, reverse=False, max_limit=MAX_LIMIT, on_results=None):
        self.scores, self.values = (
            map(list, zip(*sorted(data, reverse=reverse))) if data else ([], [])
        )
        self.reverse = reverse
        self.search = functools.partial(
            reverse_bisect_left if reverse else bisect.bisect_left, self.scores
        )
        self.max_limit = max_limit
        self.on_results = on_results

    def get_result(self, limit, cursor=None, count_hits=False, known_hits=None):
        limit = min(limit, self.max_limit)

        if cursor is None:
            cursor = Cursor(0, 0, False)

        assert cursor.offset > -1

        if cursor.value == 0:
            position = len(self.scores) if cursor.is_prev else 0
        else:
            position = self.search(cursor.value)

        position = position + cursor.offset

        if cursor.is_prev:
            # TODO: It might make sense to ensure that this hi value is at
            # least the length of the page + 1 if we want to ensure we return a
            # full page of results when paginating backwards while data is
            # being mutated.
            hi = min(position, len(self.scores))
            lo = max(hi - limit, 0)
        else:
            lo = max(position, 0)
            hi = min(lo + limit, len(self.scores))

        if self.scores:
            prev_score = self.scores[min(lo, len(self.scores) - 1)]
            prev_cursor = Cursor(
                prev_score, lo - self.search(prev_score, hi=lo), True, True if lo > 0 else False
            )

            next_score = self.scores[min(hi, len(self.scores) - 1)]
            next_cursor = Cursor(
                next_score,
                hi - self.search(next_score, hi=hi),
                False,
                True if hi < len(self.scores) else False,
            )
        else:
            prev_cursor = Cursor(cursor.value, cursor.offset, True, False)
            next_cursor = Cursor(cursor.value, cursor.offset, False, False)

        results = self.values[lo:hi]
        if self.on_results:
            results = self.on_results(results)

        if known_hits is not None:
            hits = min(known_hits, MAX_HITS_LIMIT)
        elif count_hits:
            hits = min(len(self.scores), MAX_HITS_LIMIT)
        else:
            hits = None

        return CursorResult(
            results,
            prev=prev_cursor,
            next=next_cursor,
            hits=hits,
            max_hits=MAX_HITS_LIMIT if hits is not None else None,
        )


class GenericOffsetPaginator(object):
    """
    A paginator for getting pages of results for a query using the OFFSET/LIMIT
    mechanism.

    This class makes the assumption that the query provides a static,
    totally-ordered view on the data, so that the next page of data can be
    retrieved by incrementing OFFSET to the next multiple of LIMIT with no
    overlaps or gaps from the previous page.

    It is potentially less performant than a ranged query solution that might
    not to have to look at as many rows.

    Can either take data as a list or dictionary with data as value in order to
    return full object if necessary. (if isinstance statement)
    """

    def __init__(self, data_fn):
        self.data_fn = data_fn

    def get_result(self, limit, cursor=None):
        assert limit > 0
        offset = cursor.offset if cursor is not None else 0
        # Request 1 more than limit so we can tell if there is another page
        data = self.data_fn(offset=offset, limit=limit + 1)

        if isinstance(data, list):
            has_more = len(data) == limit + 1
            if has_more:
                data.pop()
        elif isinstance(data.get("data"), list):
            has_more = len(data["data"]) == limit + 1
            if has_more:
                data["data"].pop()
        else:
            raise NotImplementedError

        # Since we are not issuing ranged queries, our cursors always have
        # `value=0` (ie. all rows have the same value), and so offset naturally
        # becomes the absolute row offset from the beginning of the entire
        # dataset, which is the same meaning as SQLs `OFFSET`.
        return CursorResult(
            data,
            prev=Cursor(0, max(0, offset - limit), True, offset > 0),
            next=Cursor(0, max(0, offset + limit), False, has_more),
        )
        # TODO use Cursor.value as the `end` argument to data_fn() so that
        # subsequent pages returned using these cursors are using the same end
        # date for queries, this should stop drift from new incoming events.
