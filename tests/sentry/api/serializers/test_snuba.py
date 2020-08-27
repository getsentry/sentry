from __future__ import absolute_import

import unittest
from datetime import timedelta

import pytz
from django.utils import timezone

from sentry.api.serializers.snuba import SnubaTSResultSerializer, zerofill
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.dates import to_timestamp
from sentry.utils.snuba import SnubaTSResult


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


class SnubaTSResultSerializerTest(TestCase):
    def run_test(self, start, values, rollup, expected, max_buckets=None):
        start = start.replace(tzinfo=pytz.utc, microsecond=0, second=0)
        end = start + (rollup * len(values))

        data = []
        for i, value in enumerate(values):
            row = {}
            row["time"] = int(to_timestamp(start + (rollup * i)))
            if value is not None:
                row["count"] = value
            data.append(row)

        result = SnubaTSResult({"data": data}, start, end, int(rollup.total_seconds()))
        serializer = SnubaTSResultSerializer(
            self.organization, None, self.user, max_buckets=max_buckets
        )
        assert [item[1][0] for item in serializer.serialize(result)["data"]] == expected

    def test(self):
        self.run_test(
            before_now(days=1),
            [None, 2, 1, None],
            timedelta(minutes=1),
            [{"count": 0}, {"count": 2}, {"count": 1}, {"count": 0}],
        )

    def test_max_buckets(self):
        self.run_test(
            before_now(days=1),
            [None, 2, 1, None],
            timedelta(minutes=1),
            [{"max": 2, "avg": 1.0, "min": 0}, {"max": 1, "avg": 0.5, "min": 0}],
            max_buckets=2,
        )
        self.run_test(
            before_now(days=1),
            [500, 267, 354, 350, 324, 600, 235],
            timedelta(minutes=1),
            [
                {"max": 500, "avg": 373.6666666666667, "min": 267},
                {"max": 600, "avg": 424.6666666666667, "min": 324},
                {"max": 235, "avg": 235.0, "min": 235},
            ],
            max_buckets=3,
        )
