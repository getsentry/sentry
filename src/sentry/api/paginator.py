import bisect
import functools
import math
from datetime import datetime

from django.core.exceptions import ObjectDoesNotExist
from django.db import connections
from django.db.models.functions import Lower
from django.db.models.sql.datastructures import EmptyResultSet
from django.utils import timezone

from sentry.utils.compat import map, zip
from sentry.utils.cursors import Cursor, CursorResult, build_cursor

quote_name = connections["default"].ops.quote_name


MAX_LIMIT = 100
MAX_HITS_LIMIT = 1000


class BadPaginationError(Exception):
    pass


class BasePaginator:
    def __init__(
        self, queryset, order_by=None, max_limit=MAX_LIMIT, on_results=None, post_query_filter=None
    ):

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
        self.post_query_filter = post_query_filter

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

            col = col_query if "." in col_query else f"{queryset.model._meta.db_table}.{col_query}"
            operator = ">=" if asc else "<="
            queryset = queryset.extra(
                where=[f"{col} {operator} %s"],
                params=col_params,
            )

        return queryset

    def get_item_key(self, item, for_prev):
        raise NotImplementedError

    def value_from_cursor(self, cursor):
        raise NotImplementedError

    def get_result(self, limit=100, cursor=None, count_hits=False, known_hits=None, max_hits=None):
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

        # max_hits can be limited to speed up the query
        if max_hits is None:
            max_hits = MAX_HITS_LIMIT
        if count_hits:
            hits = self.count_hits(max_hits)
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

        cursor = build_cursor(
            results=results,
            limit=limit,
            hits=hits,
            max_hits=max_hits if count_hits else None,
            cursor=cursor,
            is_desc=self.desc,
            key=self.get_item_key,
            on_results=self.on_results,
        )

        # Note that this filter is just to remove unwanted rows from the result set.
        # This will reduce the number of rows returned rather than fill a full page,
        # and could result in an empty page being returned
        if self.post_query_filter:
            cursor.results = self.post_query_filter(cursor.results)

        return cursor

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
        cursor.execute(f"SELECT COUNT(*) FROM ({h_sql}) as t", h_params)
        return cursor.fetchone()[0]


class Paginator(BasePaginator):
    def get_item_key(self, item, for_prev=False):
        value = getattr(item, self.key)
        return int(math.floor(value) if self._is_asc(for_prev) else math.ceil(value))

    def value_from_cursor(self, cursor):
        return cursor.value


class DateTimePaginator(BasePaginator):
    multiplier = 1000

    def get_item_key(self, item, for_prev=False):
        value = getattr(item, self.key)
        value = float(value.strftime("%s.%f")) * self.multiplier
        return int(math.floor(value) if self._is_asc(for_prev) else math.ceil(value))

    def value_from_cursor(self, cursor):
        return datetime.fromtimestamp(float(cursor.value) / self.multiplier).replace(
            tzinfo=timezone.utc
        )


# TODO(dcramer): previous cursors are too complex at the moment for many things
# and are only useful for polling situations. The OffsetPaginator ignores them
# entirely and uses standard paging
class OffsetPaginator:
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


class MergingOffsetPaginator(OffsetPaginator):
    """This paginator uses a function to first look up items from an
    independently paginated resource to only then fall back to a query set.
    This is for instance useful if you want to query snuba for the primary
    sort order and then look up data in postgres.
    """

    def __init__(
        self,
        queryset,
        data_load_func,
        apply_to_queryset,
        key_from_model=None,
        key_from_data=None,
        max_limit=MAX_LIMIT,
        on_results=None,
    ):
        super().__init__(queryset, max_limit=max_limit, on_results=on_results)
        self.data_load_func = data_load_func
        self.apply_to_queryset = apply_to_queryset
        self.key_from_model = key_from_model or (lambda x: x.id)
        self.key_from_data = key_from_data or (lambda x: x)

    def get_result(self, limit=100, cursor=None):
        if cursor is None:
            cursor = Cursor(0, 0, 0)

        limit = min(limit, self.max_limit)

        page = cursor.offset
        offset = cursor.offset * cursor.value
        limit = (cursor.value or limit) + 1

        if self.max_offset is not None and offset >= self.max_offset:
            raise BadPaginationError("Pagination offset too large")
        if offset < 0:
            raise BadPaginationError("Pagination offset cannot be negative")

        primary_results = self.data_load_func(offset=offset, limit=limit)

        queryset = self.apply_to_queryset(self.queryset, primary_results)

        mapping = {}
        for model in queryset:
            mapping[self.key_from_model(model)] = model

        results = []
        for row in primary_results:
            model = mapping.get(self.key_from_data(row))
            if model is not None:
                results.append(model)

        next_cursor = Cursor(limit, page + 1, False, len(primary_results) > limit)
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


class SequencePaginator:
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

    def get_result(self, limit, cursor=None, count_hits=False, known_hits=None, max_hits=None):
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

        # max_hits can be limited to speed up the query
        if max_hits is None:
            max_hits = MAX_HITS_LIMIT
        if known_hits is not None:
            hits = min(known_hits, max_hits)
        elif count_hits:
            hits = min(len(self.scores), max_hits)
        else:
            hits = None

        return CursorResult(
            results,
            prev=prev_cursor,
            next=next_cursor,
            hits=hits,
            max_hits=max_hits if hits is not None else None,
        )


class GenericOffsetPaginator:
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


class CombinedQuerysetIntermediary:
    is_empty = False

    def __init__(self, queryset, order_by):
        assert isinstance(order_by, list), "order_by must be a list of keys/field names"
        self.queryset = queryset
        self.order_by = order_by
        try:
            instance = queryset[:1].get()
            self.instance_type = type(instance)
            for key in self.order_by:
                self._assert_has_field(instance, key)
            self.order_by_type = type(getattr(instance, self.order_by[0]))
        except ObjectDoesNotExist:
            self.is_empty = True

    def _assert_has_field(self, instance, field):
        assert hasattr(
            instance, field
        ), f"Model of type {self.instance_type} does not have field {field}"


class CombinedQuerysetPaginator:
    """This paginator can be used to paginate between multiple querysets.
    It needs to be passed a list of CombinedQuerysetIntermediary. Each CombinedQuerysetIntermediary must be populated with a queryset and an order_by key
        i.e. intermediaries = [
                CombinedQuerysetIntermediary(AlertRule.objects.all(), "name")
                CombinedQuerysetIntermediary(Rule.objects.all(), "label")
            ]
    and an optional parameter `desc` to determine whether the sort is ascending or descending. Default is False.

    There is an issue with sorting between multiple models using a mixture of
    date fields and non-date fields. This is because the cursor value is converted differently for dates vs non-dates.
    It assumes if _any_ field is a date key, all of them are.

    There is an assertion in the constructor to help prevent this from manifesting.
    """

    multiplier = 1000000  # Use microseconds for date keys.
    using_dates = False
    model_key_map = {}

    def __init__(self, intermediaries, desc=False, on_results=None, case_insensitive=False):
        self.desc = desc
        self.intermediaries = intermediaries
        self.on_results = on_results
        self.case_insensitive = case_insensitive
        for intermediary in list(self.intermediaries):
            if intermediary.is_empty:
                self.intermediaries.remove(intermediary)
            else:
                self.model_key_map[intermediary.instance_type] = intermediary.order_by

        # This is an assertion to make sure date field sorts are all or nothing.###
        # (i.e. all fields must be a date type, or none of them)
        using_other = False
        for intermediary in self.intermediaries:
            if intermediary.order_by_type is datetime:
                self.using_dates = True
            else:
                using_other = True

        if self.using_dates:
            assert (
                not using_other
            ), "When sorting by a date, it must be the key used on all intermediaries"

    def key_from_item(self, item):
        return self.model_key_map.get(type(item))[0]

    def _prep_value(self, item, key, for_prev):
        value = getattr(item, key)
        value_type = type(value)
        if isinstance(value, float):
            return math.floor(value) if self._is_asc(for_prev) else math.ceil(value)
        elif value_type is str and self.case_insensitive:
            return value.lower()
        return value

    def get_item_key(self, item, for_prev=False):
        if self.using_dates:
            return int(
                self.multiplier * float(getattr(item, self.key_from_item(item)).strftime("%s.%f"))
            )
        else:
            return self._prep_value(item, self.key_from_item(item), for_prev)

    def value_from_cursor(self, cursor):
        if self.using_dates:
            return datetime.fromtimestamp(float(cursor.value) / self.multiplier).replace(
                tzinfo=timezone.utc
            )
        else:
            value = cursor.value
            if isinstance(value, float):
                return math.floor(value) if self._is_asc(cursor.is_prev) else math.ceil(value)
            return value

    def _is_asc(self, is_prev):
        return (self.desc and is_prev) or not (self.desc or is_prev)

    def _build_combined_querysets(self, value, is_prev, limit, extra):
        asc = self._is_asc(is_prev)
        combined_querysets = list()
        for intermediary in self.intermediaries:
            key = intermediary.order_by[0]
            filters = {}
            annotate = {}

            if self.case_insensitive:
                key = f"{key}_lower"
                annotate[key] = Lower(intermediary.order_by[0])

            if asc:
                filter_condition = f"{key}__gte"
            else:
                filter_condition = f"{key}__lte"

            if value is not None:
                filters[filter_condition] = value

            queryset = intermediary.queryset.annotate(**annotate).filter(**filters)
            for key in intermediary.order_by:
                if self.case_insensitive:
                    key = f"{key}_lower"
                if asc:
                    queryset = queryset.order_by(key)
                else:
                    queryset = queryset.order_by(f"-{key}")

            queryset = queryset[: (limit + extra)]
            combined_querysets += list(queryset)

        def _sort_combined_querysets(item):
            sort_keys = []
            sort_keys.append(self.get_item_key(item, is_prev))
            if len(self.model_key_map.get(type(item))) > 1:
                for k in self.model_key_map.get(type(item))[1:]:
                    sort_keys.append(k)
            sort_keys.append(type(item).__name__)
            return tuple(sort_keys)

        combined_querysets.sort(
            key=_sort_combined_querysets,
            reverse=not asc,
        )

        return combined_querysets

    def get_result(self, cursor=None, limit=100):
        if cursor is None:
            cursor = Cursor(0, 0, 0)

        if cursor.value:
            cursor_value = self.value_from_cursor(cursor)
        else:
            cursor_value = None

        limit = min(limit, MAX_LIMIT)

        offset = cursor.offset
        extra = 1
        if cursor.is_prev and cursor.value:
            extra += 1
        combined_querysets = self._build_combined_querysets(
            cursor_value, cursor.is_prev, limit, extra
        )

        stop = offset + limit + extra
        results = list(combined_querysets[offset:stop])

        if cursor.is_prev and cursor.value:
            # If the first result is equal to the cursor_value then it's safe to filter
            # it out, since the value hasn't been updated
            if results and self.get_item_key(results[0], for_prev=True) == cursor.value:
                results = results[1:]
            # Otherwise we may have fetched an extra row, just drop it off the end if so.
            elif len(results) == offset + limit + extra:
                results = results[:-1]

        # We reversed the results when generating the querysets, so we need to reverse back now.
        if cursor.is_prev:
            results.reverse()

        return build_cursor(
            results=results,
            cursor=cursor,
            key=self.get_item_key,
            limit=limit,
            is_desc=self.desc,
            on_results=self.on_results,
        )


class ChainPaginator:
    """
    Chain multiple datasources together and paginate them as one source.
    The datasources should be provided in the order they should be used.

    The `sources` should be a list of sliceable collections. It is also
    assumed that sources have their data sorted already.
    """

    def __init__(self, sources, max_limit=MAX_LIMIT, max_offset=None, on_results=None):
        self.sources = sources
        self.max_limit = max_limit
        self.max_offset = max_offset
        self.on_results = on_results

    def get_result(self, limit=100, cursor=None):
        # offset is page #
        # value is page limit
        if cursor is None:
            cursor = Cursor(0, 0, 0)

        limit = min(limit, self.max_limit)

        page = cursor.offset
        offset = cursor.offset * cursor.value

        if self.max_offset is not None and offset >= self.max_offset:
            raise BadPaginationError("Pagination offset too large")
        if limit <= 0:
            raise BadPaginationError("Limit must be positive")
        if offset < 0:
            raise BadPaginationError("Pagination offset cannot be negative")

        results = []
        # note: we shouldn't use itertools.islice(itertools.chain.from_iterable(self.sources))
        # because source may be a QuerySet which is much more efficient to slice directly
        for source in self.sources:
            # Get an additional item so we can check for a next page.
            remaining = limit - len(results) + 1
            results.extend(source[offset : offset + remaining])
            # don't do offset = max(0, offset - len(source)) because len(source) may be expensive
            if len(results) == 0:
                offset -= len(source)
            else:
                offset = 0
            if len(results) > limit:
                assert len(results) == limit + 1
                break

        next_cursor = Cursor(limit, page + 1, False, len(results) > limit)
        prev_cursor = Cursor(limit, page - 1, True, page > 0)

        if next_cursor.has_results:
            results.pop()

        if self.on_results:
            results = self.on_results(results)

        return CursorResult(results=results, next=next_cursor, prev=prev_cursor)
