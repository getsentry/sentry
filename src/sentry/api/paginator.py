"""
sentry.api.paginator
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import math

from datetime import datetime
from django.db import connections
from django.db.models.sql.datastructures import EmptyResultSet
from django.utils import timezone

from sentry.utils.cursors import build_cursor, Cursor, CursorResult

quote_name = connections['default'].ops.quote_name


class BasePaginator(object):
    def __init__(self, queryset, order_by=None, max_limit=100):
        if order_by:
            if order_by.startswith('-'):
                self.key, self.desc = order_by[1:], True
            else:
                self.key, self.desc = order_by, False
        else:
            self.key = None
            self.desc = False
        self.queryset = queryset
        self.max_limit = max_limit

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
                    queryset.query.order_by[index] = '-%s' % (queryset.query.order_by[index])
            elif ('-%s' % self.key) in queryset.query.order_by:
                if asc:
                    index = queryset.query.order_by.index('-%s' % (self.key))
                    queryset.query.order_by[index] = queryset.query.order_by[index][1:]
            else:
                if asc:
                    queryset = queryset.order_by(self.key)
                else:
                    queryset = queryset.order_by('-%s' % self.key)

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
                    where=['%s.%s >= %%s' % (queryset.model._meta.db_table, col_query, )],
                    params=col_params,
                )
            else:
                queryset = queryset.extra(
                    where=['%s.%s <= %%s' % (queryset.model._meta.db_table, col_query, )],
                    params=col_params,
                )

        return queryset

    def get_item_key(self, item, for_prev):
        raise NotImplementedError

    def value_from_cursor(self, cursor):
        raise NotImplementedError

    def get_result(self, limit=100, cursor=None, count_hits=False):
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
            max_hits = 1000
            hits = self.count_hits(max_hits)
        else:
            hits = None
            max_hits = None

        offset = cursor.offset
        # this effectively gets us the before row, and the current (after) row
        # every time. Do not offset if the provided cursor value was empty since
        # there is nothing to traverse past.
        if cursor.is_prev and cursor.value:
            offset += 1

        # The + 1 is needed so we can decide in the ResultCursor if there is
        # more on the next page.
        stop = offset + limit + 1
        results = list(queryset[offset:stop])
        if cursor.is_prev:
            results.reverse()

        return build_cursor(
            results=results,
            limit=limit,
            hits=hits,
            max_hits=max_hits,
            cursor=cursor,
            is_desc=self.desc,
            key=self.get_item_key,
        )

    def count_hits(self, max_hits):
        if not max_hits:
            return 0
        hits_query = self.queryset.values()[:max_hits].query
        # clear out any select fields (include select_related) and pull just the id
        hits_query.clear_select_clause()
        hits_query.add_fields(['id'])
        hits_query.clear_ordering(force_empty=True)
        try:
            h_sql, h_params = hits_query.sql_with_params()
        except EmptyResultSet:
            return 0
        cursor = connections[self.queryset.db].cursor()
        cursor.execute(u'SELECT COUNT(*) FROM ({}) as t'.format(
            h_sql,
        ), h_params)
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
        value = float(value.strftime('%s.%f')) * self.multiplier
        return math.floor(value) if self._is_asc(for_prev) else math.ceil(value)

    def value_from_cursor(self, cursor):
        return datetime.fromtimestamp(float(cursor.value) / self.multiplier).replace(
            tzinfo=timezone.utc
        )


# TODO(dcramer): previous cursors are too complex at the moment for many things
# and are only useful for polling situations. The OffsetPaginator ignores them
# entirely and uses standard paging
class OffsetPaginator(BasePaginator):
    def get_result(self, limit=100, cursor=None):
        # offset is page #
        # value is page limit
        if cursor is None:
            cursor = Cursor(0, 0, 0)

        limit = min(limit, self.max_limit)

        queryset = self.queryset
        if self.key:
            if self.desc:
                queryset = queryset.order_by('-{}'.format(self.key))
            else:
                queryset = queryset.order_by(self.key)

        page = cursor.offset
        offset = cursor.offset * cursor.value
        stop = offset + (cursor.value or limit) + 1

        results = list(queryset[offset:stop])
        if cursor.value != limit:
            results = results[-(limit + 1):]

        next_cursor = Cursor(limit, page + 1, False, len(results) > limit)
        prev_cursor = Cursor(limit, page - 1, True, page > 0)

        return CursorResult(
            results=results[:limit],
            next=next_cursor,
            prev=prev_cursor,
        )
