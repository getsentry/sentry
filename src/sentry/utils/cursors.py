"""
sentry.utils.cursors
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six

from collections import Sequence


class Cursor(object):
    def __init__(self, value, offset=0, is_prev=False, has_results=None):
        # XXX: ceil is not entirely correct here, but it's a simple hack
        # that solves most problems
        self.value = int(value)
        self.offset = int(offset)
        self.is_prev = bool(is_prev)
        self.has_results = has_results

    def __str__(self):
        return '%s:%s:%s' % (self.value, self.offset, int(self.is_prev))

    def __repr__(self):
        return '<%s: value=%s offset=%s is_prev=%s>' % (
            type(self), self.value, self.offset, int(self.is_prev))

    def __nonzero__(self):
        return self.has_results

    @classmethod
    def from_string(cls, value):
        bits = value.split(':')
        if len(bits) != 3:
            raise ValueError
        try:
            bits = float(bits[0]), int(bits[1]), int(bits[2])
        except (TypeError, ValueError):
            raise ValueError
        return cls(*bits)


class CursorResult(Sequence):
    def __init__(self, results, next, prev):
        self.results = results
        self.next = next
        self.prev = prev

    def __len__(self):
        return len(self.results)

    def __iter__(self):
        return iter(self.results)

    def __getitem__(self, key):
        return self.results[key]

    def __repr__(self):
        return '<%s: results=%s>' % (type(self).__name__, len(self.results))

    @classmethod
    def from_ids(cls, id_list, key=None, limit=100, cursor=None):
        from sentry.models import Group

        group_map = Group.objects.in_bulk(id_list)

        results = []
        for g_id in id_list:
            try:
                results.append(group_map[g_id])
            except KeyError:
                pass

        return build_cursor(
            results=results,
            key=key,
            cursor=cursor,
            limit=limit,
        )


def build_cursor(results, key, limit=100, cursor=None):
    if cursor is None:
        cursor = Cursor(0, 0, 0)

    value = cursor.value
    offset = cursor.offset
    is_prev = cursor.is_prev

    num_results = len(results)

    if is_prev:
        has_prev = num_results > limit
        num_results = len(results)
    elif value or offset:
        # It's likely that there's a previous page if they passed us either offset values
        has_prev = True
    else:
        # we don't know
        has_prev = False

    # Default cursor if not present
    if is_prev:
        next_value = value
        next_offset = offset
        has_next = True
    elif num_results:
        if not value:
            value = int(key(results[0]))

        # Are there more results than whats on the current page?
        has_next = num_results > limit

        # Determine what our next cursor is by ensuring we have a unique offset
        next_value = int(key(results[-1]))

        if next_value == value:
            next_offset = offset + limit
        else:
            next_offset = 0
            result_iter = reversed(results)
            # skip the last result
            six.next(result_iter)
            for result in result_iter:
                if int(key(result)) == next_value:
                    next_offset += 1
                else:
                    break
    else:
        next_value = value
        next_offset = offset
        has_next = False

    # Determine what our pervious cursor is by ensuring we have a unique offset
    if is_prev and num_results:
        prev_value = int(key(results[0]))

        if num_results > 2:
            i = 1
            while i < num_results and prev_value == int(key(results[i])):
                i += 1
            i -= 1
        else:
            i = 0

        # if we iterated every result and the offset didn't change, we need
        # to simply add the current offset to our total results (visible)
        if prev_value == value:
            prev_offset = offset + i
        else:
            prev_offset = i
    else:
        # previous cursor is easy if we're paginating forward
        prev_value = value
        prev_offset = offset

    # Truncate the list to our original result size now that we've determined the next page
    results = results[:limit]

    next_cursor = Cursor(next_value or 0, next_offset, False, has_next)
    prev_cursor = Cursor(prev_value or 0, prev_offset, True, has_prev)

    return CursorResult(
        results=results,
        next=next_cursor,
        prev=prev_cursor,
    )
