from __future__ import absolute_import

import itertools


def chunked(iterator, size):
    chunk = []
    for item in iterator:
        chunk.append(item)
        if len(chunk) == size:
            yield chunk
            chunk = []

    if chunk:
        yield chunk


def lookahead(iterator):
    actual, ahead = itertools.tee(iterator)
    next(ahead, None)
    for value in actual:
        yield value, next(ahead, None)
