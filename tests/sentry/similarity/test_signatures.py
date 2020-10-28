from __future__ import absolute_import

from collections import Counter
from unittest import TestCase

from sentry.similarity.signatures import MinHashSignatureBuilder
from sentry.utils.compat import map
from sentry.utils.compat import zip


class MinHashSignatureBuilderTestCase(TestCase):
    def test_signatures(self):
        n = 32
        r = 0xFFFF
        get_signature = MinHashSignatureBuilder(n, r)
        get_signature(set(["foo", "bar", "baz"])) == get_signature(set(["foo", "bar", "baz"]))

        assert len(get_signature("hello world")) == n
        for value in get_signature("hello world"):
            assert 0 <= value < r

        a = set("the quick grown box jumps over the hazy fog".split())
        b = set("the quick brown fox jumps over the lazy dog".split())

        results = Counter(
            map(lambda l__r: l__r[0] == l__r[1], zip(get_signature(a), get_signature(b)))
        )

        similarity = len(a & b) / float(len(a | b))
        estimation = results[True] / float(sum(results.values()))

        self.assertAlmostEqual(
            similarity, estimation, delta=0.1  # totally made up constant, seems reasonable
        )
