from collections.abc import Sequence


class Cursor:
    def __init__(self, value, offset=0, is_prev=False, has_results=None):
        self.value = value
        self.offset = int(offset)
        self.is_prev = bool(is_prev)
        self.has_results = has_results

    def __str__(self):
        return f"{self.value}:{self.offset}:{int(self.is_prev)}"

    def __eq__(self, other):
        return all(
            getattr(self, attr) == getattr(other, attr)
            for attr in ("value", "offset", "is_prev", "has_results")
        )

    def __repr__(self):
        return "<{}: value={} offset={} is_prev={}>".format(
            type(self).__name__,
            self.value,
            self.offset,
            int(self.is_prev),
        )

    def __bool__(self):
        return bool(self.has_results)

    # python2 compatibility
    __nonzero__ = __bool__

    @classmethod
    def from_string(cls, value):
        bits = value.split(":")
        if len(bits) != 3:
            raise ValueError
        try:
            value = float(bits[0]) if "." in bits[0] else int(bits[0])
            bits = value, int(bits[1]), int(bits[2])
        except (TypeError, ValueError):
            raise ValueError
        return cls(*bits)


class SCIMCursor(Cursor):
    @classmethod
    def from_string(cls, value):
        # SCIM cursors are 1 indexed
        return cls(0, int(value) - 1, 0)


class StringCursor(Cursor):
    @classmethod
    def from_string(cls, value):
        bits = value.rsplit(":", 2)
        if len(bits) != 3:
            raise ValueError
        try:
            value = bits[0]
            bits = value, int(bits[1]), int(bits[2])
        except (TypeError, ValueError):
            raise ValueError
        return cls(*bits)


class CursorResult(Sequence):
    def __init__(self, results, next, prev, hits=None, max_hits=None):
        self.results = results
        self.next = next
        self.prev = prev
        self.hits = hits
        self.max_hits = max_hits

    def __len__(self):
        return len(self.results)

    def __iter__(self):
        return iter(self.results)

    def __getitem__(self, key):
        return self.results[key]

    def __repr__(self):
        return f"<{type(self).__name__}: results={len(self.results)}>"


def _build_next_values(cursor, results, key, limit, is_desc):
    value = cursor.value
    offset = cursor.offset
    is_prev = cursor.is_prev

    num_results = len(results)

    if not value and num_results:
        value = key(results[0])

    # Next cursor for a prev-cursor simply starts from that prev cursors value
    # without an offset.
    if is_prev:
        return (value, 0, True)

    # No results means no more next
    if not num_results:
        return (value, offset, False)

    # Are there more results than whats on the current page?
    has_next = num_results > limit

    # Determine what our next cursor is by ensuring we have a unique offset
    next_value = key(results[-1])

    # value has not changed, page forward by adjusting the offset
    if next_value == value:
        next_offset = offset + limit
        return (next_value, next_offset, has_next)

    # We have an absolute value to page from. If any of the items in
    # the current result set come *after* or *before* (depending on the
    # is_desc flag) we will want to increment the offset to account for
    # moving past them.
    #
    # This is required to account for loss of precision in the key value.
    next_offset = 0
    result_iter = reversed(results)

    # If we have more results the last item in the results should be
    # skipped, as we know we want to start from that item and do not
    # need to offset from it.
    if has_next:
        next(result_iter)

    for result in result_iter:
        result_value = key(result)

        is_larger = result_value >= next_value
        is_smaller = result_value <= next_value

        if (is_desc and is_smaller) or (not is_desc and is_larger):
            next_offset += 1
        else:
            break

    return (next_value, next_offset, has_next)


def _build_prev_values(cursor, results, key, limit, is_desc):
    value = cursor.value
    offset = cursor.offset
    is_prev = cursor.is_prev

    num_results = len(results)

    if is_prev:
        has_prev = num_results > limit
    else:
        # It's likely that there's a previous page if they passed us either
        # offset values
        has_prev = value or offset

    # If the cursor contains previous results, the first item is the item that
    # indicates if we have more items later, and is *not* the first item in the
    # list, that should be used for the value.
    first_prev_index = 1 if is_prev and has_prev else 0

    # If we're paging back we need to calculate the key from the first result
    # with for_prev=True to ensure rounding of the key is correct.See
    # sentry.api.paginator.BasePaginator.get_item_key
    prev_value = key(results[first_prev_index], for_prev=True) if results else 0

    # Prev only has an offset if the cursor we were dealing with was a
    # previous cursor. Otherwise we'd be taking the offset while moving forward.
    prev_offset = offset if is_prev else 0

    if not (is_prev and num_results):
        return (prev_value, prev_offset, has_prev)

    # Value has not changed, page back by adjusting the offset
    if prev_value == value:
        prev_offset = offset + limit
        return (prev_value, prev_offset, has_prev)

    # Just as in the next cursor builder, we may need to add an offset
    # if any of the results at the beginning are *before* or *after*
    # (depending on the is_desc flag).
    #
    # This is required to account for loss of precision in the key value.
    prev_offset = 0
    result_iter = iter(results)

    # If we know there are more previous results, we need to move past
    # the item indicating that more items exist.
    if has_prev:
        next(result_iter)

    # Always move past the first item, this is the prev_value item and will
    # already be offset in the next query.
    next(result_iter)

    for result in result_iter:
        result_value = key(result, for_prev=True)

        is_larger = result_value >= prev_value
        is_smaller = result_value <= prev_value

        # Note that the checks are reversed here as a prev query has
        # it's ordering reversed.
        if (is_desc and is_larger) or (not is_desc and is_smaller):
            prev_offset += 1
        else:
            break

    return (prev_value, prev_offset, has_prev)


def build_cursor(
    results, key, limit=100, is_desc=False, cursor=None, hits=None, max_hits=None, on_results=None
):
    if cursor is None:
        cursor = Cursor(0, 0, 0)

    # Compute values for next cursor
    next_value, next_offset, has_next = _build_next_values(
        cursor=cursor, results=results, key=key, limit=limit, is_desc=is_desc
    )

    # Compute values for prev cursor
    prev_value, prev_offset, has_prev = _build_prev_values(
        cursor=cursor, results=results, key=key, limit=limit, is_desc=is_desc
    )

    if cursor.is_prev and has_prev:
        # A prev cursor with more results should have the first item chopped off
        # as this is the item that indicates we have more items before, and
        # should not be included on this page.
        results = results[1:]
    elif not cursor.is_prev:
        # For next page cursors we cut off the extra item that indicates there
        # are more items.
        results = results[:limit]

    next_cursor = Cursor(next_value or 0, next_offset, False, has_next)
    prev_cursor = Cursor(prev_value or 0, prev_offset, True, has_prev)

    if on_results:
        results = on_results(results)

    return CursorResult(
        results=results, next=next_cursor, prev=prev_cursor, hits=hits, max_hits=max_hits
    )
