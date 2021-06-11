from unittest import TestCase

from sentry.utils.functional import cached, compact


class CompactTest(TestCase):
    def test_none(self):
        assert compact({"foo": None, "bar": 1}) == {"bar": 1}

    def test_zero(self):
        assert compact({"foo": 0}) == {"foo": 0}

    def test_false(self):
        assert compact({"foo": False}) == {"foo": False}

    def test_empty_string(self):
        assert compact({"foo": ""}) == {"foo": ""}


class CachedTest(TestCase):
    def test_kwargs(self):
        """Order of kwargs should not matter"""

        def foo(**kwargs):
            foo.call_count += 1

        foo.call_count = 0

        cache = {}
        cached(cache, foo, kw1=1, kw2=2)
        assert foo.call_count == 1

        # Call with different kwargs order - call_count is still one:
        cached(cache, foo, kw2=2, kw1=1)
        assert foo.call_count == 1
