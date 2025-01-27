import itertools
from collections.abc import Generator, Iterable
from typing import TypeVar

T = TypeVar("T")


def advance(n: int, iterator: Iterable[T]) -> Iterable[T]:
    """Advances an iterator n places."""
    next(itertools.islice(iterator, n, n), None)
    return iterator


def shingle(n: int, iterator: Iterable[T]) -> list[tuple[T, ...]]:
    """\
    Shingle a token stream into N-grams.

    >>> list(shingle(2, ('foo', 'bar', 'baz')))
    [('foo', 'bar'), ('bar', 'baz')]
    """
    return list(
        zip(
            *map(
                lambda i__iterator: advance(i__iterator[0], i__iterator[1]),
                enumerate(itertools.tee(iterator, n)),
            )
        )
    )


def chunked(iterator: Iterable[T], size: int) -> Generator[list[T]]:
    chunk = []
    for item in iterator:
        chunk.append(item)
        if len(chunk) == size:
            yield chunk
            chunk = []

    if chunk:
        yield chunk
