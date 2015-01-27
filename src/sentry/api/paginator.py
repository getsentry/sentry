from __future__ import absolute_import

import datetime


class CursorResult(object):
    def __init__(self, results, next, prev=None, has_prev=None, has_next=None):
        self.next = next
        self.prev = prev
        self.has_next = has_next
        self.has_prev = has_prev
        self.results = results

    def get_response(self):
        return self.results


class Paginator(object):
    def __init__(self, queryset, order_by):
        if order_by.startswith('-'):
            self.key, self.desc = order_by[1:], True
        else:
            self.key, self.desc = order_by, False
        self.queryset = queryset

    def _get_results_from_qs(self, cursor_offset, is_prev):
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

        if cursor_offset:
            if asc:
                results = results.filter(**{'%s__gte' % self.key: cursor_offset})
            else:
                results = results.filter(**{'%s__lte' % self.key: cursor_offset})

        return results

    def get_cursor(self, limit=100, cursor=None):
        # cursors are:
        #   (identifier(integer), row offset, is_previous)

        cursor = cursor or (0, 0, 0)

        if cursor:
            cursor_offset, offset, is_prev = map(int, cursor)
        else:
            cursor_offset, offset, is_prev = 0, 0, 0

        results = self._get_results_from_qs(cursor_offset, is_prev)

        if is_prev:
            # this effectively gets us the before post, and the current (after) post
            stop = offset + limit + 2
        else:
            stop = offset + limit + 1

        results = list(results[offset:stop])

        num_results = len(results)

        if is_prev:
            has_prev = num_results > (limit + 1)
            results = [r for r in reversed(results[:limit + 1])]
            num_results = len(results)
        elif cursor_offset or offset:
            # It's likely that there's a previous page if they passed us either offset values
            has_prev = True
        else:
            # we don't know
            has_prev = False

        # Default cursor if not present
        if is_prev:
            next_cursor_offset = cursor_offset
            next_offset = offset

            # Are there more results than whats on the current page?
            has_next = num_results > limit
        elif num_results:
            if not cursor_offset:
                cursor_offset = getattr(results[0], self.key)

            # Are there more results than whats on the current page?
            has_next = num_results > limit

            # Determine what our next cursor is by ensuring we have a unique offset
            next_cursor_offset = getattr(results[-1], self.key)

            if next_cursor_offset == cursor_offset:
                next_offset = offset + limit
            else:
                next_offset = 0

                for result in results[1 if is_prev else 0:limit][::-1]:
                    if getattr(result, self.key) == next_cursor_offset:
                        next_offset += 1
                    else:
                        break
        else:
            next_cursor_offset = cursor_offset
            next_offset = offset
            has_next = False

        # Determine what our pervious cursor is by ensuring we have a unique offset
        if is_prev and num_results:
            prev_cursor_offset = getattr(results[0], self.key)

            if num_results > 2:
                i = 1
                while i < num_results and prev_cursor_offset == getattr(results[i], self.key):
                    i += 1
                i -= 1
            else:
                i = 0

            # if we iterated every result and the offset didn't change, we need
            # to simply add the current offset to our total results (visible)
            if prev_cursor_offset == cursor_offset:
                prev_offset = offset + i
            else:
                prev_offset = i
        else:
            # previous cursor is easy if we're paginating forward
            prev_cursor_offset = cursor_offset
            prev_offset = offset

        # Truncate the list to our original result size now that we've determined the next page
        results = results[:limit]

        # XXX: We convert datetimes to unix_time and bump 7 decimal places so we don't
        # have to worry about float point restrictions. This conversion is also handled
        # in the CursorTimestamp validator
        if isinstance(next_cursor_offset, datetime.datetime):
            next_cursor_offset = int(float(next_cursor_offset.strftime('%s.%f')) * 1000000)
        if isinstance(prev_cursor_offset, datetime.datetime):
            prev_cursor_offset = int(float(prev_cursor_offset.strftime('%s.%f')) * 1000000)

        next_cursor = ':'.join(map(lambda x: str(int(x)), [next_cursor_offset or 0, next_offset, 0]))
        if has_prev:
            prev_cursor = ':'.join(map(lambda x: str(int(x)), [prev_cursor_offset or 0, prev_offset, 1]))
        else:
            prev_cursor = None

        return CursorResult(
            results=results,
            next=next_cursor,
            prev=prev_cursor,
            has_next=has_next,
            has_prev=has_prev,
        )
