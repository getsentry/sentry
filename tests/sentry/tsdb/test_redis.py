from __future__ import absolute_import

import pytz

from datetime import (
    datetime,
    timedelta,
)

from sentry.testutils import TestCase
from sentry.tsdb.base import TSDBModel, ONE_MINUTE, ONE_HOUR, ONE_DAY
from sentry.tsdb.redis import RedisTSDB
from sentry.utils.dates import to_timestamp


class RedisTSDBTest(TestCase):
    def setUp(self):
        self.db = RedisTSDB(
            rollups=(
                # time in seconds, samples to keep
                (10, 30),  # 5 minutes at 10 seconds
                (ONE_MINUTE, 120),  # 2 hours at 1 minute
                (ONE_HOUR, 24),  # 1 days at 1 hour
                (ONE_DAY, 30),  # 30 days at 1 day
            ),
            vnodes=64,
            enable_frequency_sketches=True,
        )

    def test_make_counter_key(self):
        result = self.db.make_counter_key(TSDBModel.project, 1368889980, 1)
        assert result == 'ts:1:1368889980:1'

        result = self.db.make_counter_key(TSDBModel.project, 1368889980, 'foo')
        assert result == 'ts:1:1368889980:33'

    def test_get_model_key(self):
        result = self.db.get_model_key(1)
        assert result == 1

        result = self.db.get_model_key('foo')
        assert result == 'bf4e529197e56a48ae2737505b9736e4'

    def test_simple(self):
        now = datetime.utcnow().replace(tzinfo=pytz.UTC)
        dts = [now + timedelta(hours=i) for i in xrange(4)]

        def timestamp(d):
            t = int(to_timestamp(d))
            return t - (t % 3600)

        self.db.incr(TSDBModel.project, 1, dts[0])
        self.db.incr(TSDBModel.project, 1, dts[1], count=3)
        self.db.incr(TSDBModel.project, 1, dts[2])
        self.db.incr_multi([
            (TSDBModel.project, 1),
            (TSDBModel.project, 2),
        ], dts[3], count=4)

        results = self.db.get_range(TSDBModel.project, [1], dts[0], dts[-1])
        assert results == {
            1: [
                (timestamp(dts[0]), 1),
                (timestamp(dts[1]), 3),
                (timestamp(dts[2]), 1),
                (timestamp(dts[3]), 4),
            ],
        }
        results = self.db.get_range(TSDBModel.project, [2], dts[0], dts[-1])
        assert results == {
            2: [
                (timestamp(dts[0]), 0),
                (timestamp(dts[1]), 0),
                (timestamp(dts[2]), 0),
                (timestamp(dts[3]), 4),
            ],
        }

        results = self.db.get_sums(TSDBModel.project, [1, 2], dts[0], dts[-1])
        assert results == {
            1: 9,
            2: 4,
        }

    def test_count_distinct(self):
        now = datetime.utcnow().replace(tzinfo=pytz.UTC)
        dts = [now + timedelta(hours=i) for i in xrange(4)]

        model = TSDBModel.users_affected_by_group

        def timestamp(d):
            t = int(to_timestamp(d))
            return t - (t % 3600)

        self.db.record(
            model,
            1,
            ('foo', 'bar'),
            dts[0],
        )

        self.db.record(
            model,
            1,
            ('baz',),
            dts[1],
        )

        self.db.record_multi((
            (
                model,
                1,
                ('foo', 'bar', 'baz'),
            ),
            (
                model,
                2,
                ('bar',),
            ),
        ), dts[2])

        self.db.record(
            model,
            2,
            ('foo',),
            dts[3],
        )

        assert self.db.get_distinct_counts_series(model, [1], dts[0], dts[-1], rollup=3600) == {
            1: [
                (timestamp(dts[0]), 2),
                (timestamp(dts[1]), 1),
                (timestamp(dts[2]), 3),
                (timestamp(dts[3]), 0),
            ],
        }

        assert self.db.get_distinct_counts_series(model, [2], dts[0], dts[-1], rollup=3600) == {
            2: [
                (timestamp(dts[0]), 0),
                (timestamp(dts[1]), 0),
                (timestamp(dts[2]), 1),
                (timestamp(dts[3]), 1),
            ],
        }

        results = self.db.get_distinct_counts_totals(model, [1, 2], dts[0], dts[-1], rollup=3600)
        assert results == {
            1: 3,
            2: 2,
        }

    def test_frequency_tables(self):
        now = datetime.utcnow().replace(tzinfo=pytz.UTC)
        model = TSDBModel.frequent_projects_by_organization

        self.db.record_frequency_multi(
            (
                (model, {
                    'organization:1': {
                        "project:1": 1,
                        "project:2": 2,
                        "project:3": 3,
                    },
                }),
            ),
            now
        )

        self.db.record_frequency_multi(
            (
                (model, {
                    'organization:1': {
                        "project:1": 1,
                        "project:2": 2,
                        "project:3": 3,
                        "project:4": 4,
                    },
                    "organization:2": {
                        "project:5": 1.5,
                    },
                }),
            ),
            now - timedelta(hours=1),
        )

        assert self.db.get_most_frequent(
            model,
            ('organization:1', 'organization:2'),
            now,
            rollup=3600,
        ) == {
            'organization:1': [
                ('project:3', 3.0),
                ('project:2', 2.0),
                ('project:1', 1.0),
            ],
            'organization:2': [],
        }

        assert self.db.get_most_frequent(
            model,
            ('organization:1', 'organization:2'),
            now,
            limit=1,
            rollup=3600,
        ) == {
            'organization:1': [
                ('project:3', 3.0),
            ],
            'organization:2': [],
        }

        assert self.db.get_most_frequent(
            model,
            ('organization:1', 'organization:2'),
            now - timedelta(hours=1),
            now,
            rollup=3600,
        ) == {
            'organization:1': [
                ('project:3', 3.0 + 3.0),
                ('project:2', 2.0 + 2.0),
                ('project:4', 4.0),
                ('project:1', 1.0 + 1.0),
            ],
            'organization:2': [
                ('project:5', 1.5),
            ],
        }

        rollup = 3600
        timestamp = int(to_timestamp(now) // rollup) * rollup
        assert self.db.get_frequency_series(
            model,
            {
                'organization:1': ("project:1", "project:2", "project:3", "project:4"),
                'organization:2': ("project:5",),
            },
            now - timedelta(hours=1),
            now,
            rollup=rollup,
        ) == {
            'organization:1': [
                (timestamp - rollup, {
                    "project:1": 1.0,
                    "project:2": 2.0,
                    "project:3": 3.0,
                    "project:4": 4.0,
                }),
                (timestamp, {
                    "project:1": 1.0,
                    "project:2": 2.0,
                    "project:3": 3.0,
                    "project:4": 0.0,
                }),
            ],
            'organization:2': [
                (timestamp - rollup, {
                    "project:5": 1.5,
                }),
                (timestamp, {
                    "project:5": 0.0,
                }),
            ],
        }

        assert self.db.get_frequency_totals(
            model,
            {
                'organization:1': ("project:1", "project:2", "project:3", "project:4", "project:5"),
                'organization:2': ("project:1",),
            },
            now - timedelta(hours=1),
            now,
            rollup=3600,
        ) == {
            'organization:1': {
                "project:1": 1.0 + 1.0,
                "project:2": 2.0 + 2.0,
                "project:3": 3.0 + 3.0,
                "project:4": 4.0,
                "project:5": 0.0,
            },
            'organization:2': {
                "project:1": 0.0,
            },
        }
