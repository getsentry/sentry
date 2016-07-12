def chunked(iterator, size):
    chunk = [None] * size
    idx, i = None, None
    for idx, item in enumerate(iterator):
        i = idx % size
        chunk[i] = item
        if i == size - 1:
            yield tuple(chunk)
    if idx is None:
        yield tuple()
    else:
        i += 1
        if i < size:
            yield tuple(chunk[:i])
