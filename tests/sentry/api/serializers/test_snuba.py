from __future__ import absolute_import

import unittest
from datetime import timedelta

from django.utils import timezone

from sentry.api.serializers.snuba import zerofill
from sentry.utils.dates import to_timestamp


class ZeroFillTest(unittest.TestCase):
    def run_test(self, filled_buckets, irregular_buckets, start, end, rollup, zerofilled_buckets):
        filled_buckets = [(start + (rollup * bucket), val) for bucket, val in filled_buckets]
        buckets = [(to_timestamp(date), val) for date, val in filled_buckets + irregular_buckets]
        sort_key = lambda row: row[0]
        buckets.sort(key=sort_key)
        zerofilled_buckets = [
            (to_timestamp(start + (rollup * bucket)), []) for bucket in zerofilled_buckets
        ]
        expected = buckets + zerofilled_buckets
        expected.sort(key=sort_key)
        assert zerofill(buckets, start, end, int(rollup.total_seconds())) == expected

    def test_missing_buckets(self):
        start = timezone.now().replace(minute=0, second=0, microsecond=0)
        rollup = timedelta(minutes=10)
        self.run_test(
            [(0, [0]), (1, [1])], [], start, start + timedelta(minutes=60), rollup, [2, 3, 4, 5]
        )
        self.run_test(
            [(0, [0]), (2, [1]), (4, [4])],
            [],
            start,
            start + timedelta(minutes=60),
            rollup,
            [1, 3, 5],
        )

    def test_non_rollup_buckets(self):
        start = timezone.now().replace(minute=0, second=0, microsecond=0)
        rollup = timedelta(minutes=10)
        self.run_test(
            filled_buckets=[(0, [0]), (1, [1])],
            irregular_buckets=[
                (start + timedelta(minutes=5), [5]),
                (start + timedelta(minutes=32), [8]),
            ],
            start=start,
            end=start + timedelta(minutes=60),
            rollup=rollup,
            zerofilled_buckets=[2, 3, 4, 5],
        )
