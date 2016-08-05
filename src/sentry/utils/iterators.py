from __future__ import absolute_import


def chunked(iterator, size):
    chunk = []
    for item in iterator:
        chunk.append(item)
        if len(chunk) == size:
            yield chunk
            del chunk[:]
    yield chunk
