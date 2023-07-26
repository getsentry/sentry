from collections import Counter

import pytest

from sentry.similarity.signatures import MinHashSignatureBuilder


def test_signatures() -> None:
    n = 32
    r = 0xFFFF
    get_signature = MinHashSignatureBuilder(n, r)
    assert get_signature({"foo", "bar", "baz"}) == get_signature({"foo", "bar", "baz"})

    assert len(get_signature("hello world")) == n
    for value in get_signature("hello world"):
        assert 0 <= value < r

    a = set("the quick grown box jumps over the hazy fog".split())
    b = set("the quick brown fox jumps over the lazy dog".split())

    results = Counter(map(lambda l__r: l__r[0] == l__r[1], zip(get_signature(a), get_signature(b))))

    similarity = len(a & b) / float(len(a | b))
    estimation = results[True] / float(sum(results.values()))

    assert similarity == pytest.approx(estimation, 0.1)
