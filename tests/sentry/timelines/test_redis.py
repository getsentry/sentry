import pytest

from sentry.timelines.redis import (
    Record,
    RedisBackend
)
from sentry.testutils import TestCase


class ExpectedError(Exception):
    pass


class RedisBackendTestCase(TestCase):
    def setUp(self):
        self.backend = RedisBackend(hosts={
            0: {'db': 9},
        })

    def test_simple(self):
        record = Record('key', 'value', 1)
        self.backend.add('timeline', record)

        with self.backend.digest('timeline') as records:
            assert list(records) == [record]

    def test_merge_on_failure(self):
        first = Record('first', 'value', 1)
        self.backend.add('timeline', first)

        with pytest.raises(ExpectedError):
            with self.backend.digest('timeline') as records:
                assert list(records) == [first]
                raise ExpectedError()

        second = Record('second', 'value', 2)
        self.backend.add('timeline', second)

        with self.backend.digest('timeline') as records:
            assert list(records) == [second, first]
