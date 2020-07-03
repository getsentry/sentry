from __future__ import absolute_import

import itertools


from sentry.utils.compat import map
from sentry.utils.compat import zip


def advance(n, iterator):
    """Advances an iterator n places."""
    next(itertools.islice(iterator, n, n), None)
    return iterator


def shingle(n, iterator):
    """\
    Shingle a token stream into N-grams.

    >>> list(shingle(2, ('foo', 'bar', 'baz')))
    [('foo', 'bar'), ('bar', 'baz')]
    """
    return zip(
        *map(
            lambda i__iterator: advance(i__iterator[0], i__iterator[1]),
            enumerate(itertools.tee(iterator, n)),
        )
    )


def chunked(iterator, size):
    chunk = []
    for item in iterator:
        chunk.append(item)
        if len(chunk) == size:
            yield chunk
            chunk = []

    if chunk:
        yield chunk
