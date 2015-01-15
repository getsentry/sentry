"""
sentry.api.paginator
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import math

from django.db import connections

from sentry.utils.cursors import build_cursor, Cursor

quote_name = connections['default'].ops.quote_name


class Paginator(object):
    def __init__(self, queryset, order_by):
        if order_by.startswith('-'):
            self.key, self.desc = order_by[1:], True
        else:
            self.key, self.desc = order_by, False
        self.queryset = queryset

    def _get_item_key(self, item):
        value = getattr(item, self.key)
        if self.desc:
            return math.ceil(value)
        return math.floor(value)

    def _get_results_from_qs(self, value, is_prev):
        results = self.queryset

        # "asc" controls whether or not we need to change the ORDER BY to
        # ascending.  If we're sorting by DESC but we're using a previous
        # page cursor, we'll change the ordering to ASC and reverse the
        # list below (this is so we know how to get the before/after post).
        # If we're sorting ASC _AND_ we're not using a previous page cursor,
        # then we'll need to resume using ASC.
        asc = (self.desc and is_prev) or not (self.desc or is_prev)

        # We need to reverse the ORDER BY if we're using a cursor for a
        # previous page so we know exactly where we ended last page.  The
        # results will get reversed back to the requested order below.
        if self.key in results.query.order_by:
            if not asc:
                index = results.query.order_by.index(self.key)
                results.query.order_by[index] = '-%s' % (results.query.order_by[index])
        elif ('-%s' % self.key) in results.query.order_by:
            if asc:
                index = results.query.order_by.index('-%s' % (self.key))
                results.query.order_by[index] = results.query.order_by[index][1:]
        else:
            if asc:
                results = results.order_by(self.key)
            else:
                results = results.order_by('-%s' % self.key)

        if value:
            if self.key in results.query.extra:
                col_query, col_params = results.query.extra[self.key]
                col_params = col_params[:]
            else:
                col_query, col_params = quote_name(self.key), []
            col_params.append(value)

            if asc:
                results = results.extra(
                    where=['%s >= %%s' % (col_query,)],
                    params=col_params,
                )
            else:
                results = results.extra(
                    where=['%s <= %%s' % (col_query,)],
                    params=col_params,
                )

        return results

    def get_result(self, limit=100, cursor=None):
        # cursors are:
        #   (identifier(integer), row offset, is_prev)
        if cursor is None:
            cursor = Cursor(0, 0, 0)

        queryset = self._get_results_from_qs(cursor.value, cursor.is_prev)

        # this effectively gets us the before post, and the current (after) post
        # every time
        if cursor.is_prev:
            stop = cursor.offset + limit + 2
        else:
            stop = cursor.offset + limit + 1

        results = list(queryset[cursor.offset:stop])

        if cursor.is_prev:
            results = results[1:][::-1]

        return build_cursor(
            results=results,
            limit=limit,
            cursor=cursor,
            key=self._get_item_key,
        )
