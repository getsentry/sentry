from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import pytest

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.tsdb.base import ONE_DAY, ONE_HOUR, ONE_MINUTE, TSDBModel
from sentry.tsdb.redis import RedisTSDB, SuppressionWrapper
from sentry.utils.dates import to_datetime


def test_suppression_wrapper() -> None:
    @contextmanager
    def raise_after():
        yield
        raise Exception("Boom!")

    with pytest.raises(Exception):
        with raise_after():
            pass

    with SuppressionWrapper(raise_after()):
        pass

    with SuppressionWrapper(raise_after()):
        raise Exception("should not propagate")


class RedisTSDBTest(TestCase):
    @override_options(
        {"redis.clusters": {"tsdb": {"hosts": {i - 6: {"db": i} for i in range(6, 9)}}}}
    )
    def setUp(self) -> None:
        self.db = RedisTSDB(
            rollups=(
                # time in seconds, samples to keep
                (10, 30),  # 5 minutes at 10 seconds
                (ONE_MINUTE, 120),  # 2 hours at 1 minute
                (ONE_HOUR, 24),  # 1 days at 1 hour
                (ONE_DAY, 30),  # 30 days at 1 day
            ),
            vnodes=64,
            cluster="tsdb",
        )

        # the point of this test is to demonstrate behaviour with a multi-host cluster
        assert len(self.db.cluster.hosts) == 3

    def tearDown(self) -> None:
        with self.db.cluster.all() as client:
            client.flushdb()

    def test_make_counter_key(self) -> None:
        result = self.db.make_counter_key(TSDBModel.project, 1, to_datetime(1368889980), 1, None)
        assert result == ("ts:1:1368889980:1", 1)

        result = self.db.make_counter_key(
            TSDBModel.project, 1, to_datetime(1368889980), "foo", None
        )
        assert result == ("ts:1:1368889980:46", self.db.get_model_key("foo"))

        result = self.db.make_counter_key(TSDBModel.project, 1, to_datetime(1368889980), 1, 1)
        assert result == ("ts:1:1368889980:1", "1?e=1")

        result = self.db.make_counter_key(TSDBModel.project, 1, to_datetime(1368889980), "foo", 1)
        assert result == ("ts:1:1368889980:46", str(self.db.get_model_key("foo")) + "?e=1")

    def test_get_model_key(self) -> None:
        result = self.db.get_model_key(1)
        assert result == 1

        result = self.db.get_model_key("foo")
        assert result == "bf4e529197e56a48ae2737505b9736e4"

        result = self.db.get_model_key("我爱啤酒")
        assert result == "26f980fbe1e8a9d3a0123d2049f95f28"

    def test_simple(self) -> None:
        now = datetime.now(timezone.utc) - timedelta(hours=4)
        dts = [now + timedelta(hours=i) for i in range(4)]

        def timestamp(d):
            t = int(d.timestamp())
            return t - (t % 3600)

        self.db.incr(TSDBModel.project, 1, dts[0])
        self.db.incr(TSDBModel.project, 1, dts[1], count=2)
        self.db.incr(TSDBModel.project, 1, dts[1], environment_id=1)
        self.db.incr(TSDBModel.project, 1, dts[2])
        self.db.incr_multi(
            [(TSDBModel.project, 1), (TSDBModel.project, 2)], dts[3], count=3, environment_id=1
        )
        self.db.incr_multi(
            [(TSDBModel.project, 1), (TSDBModel.project, 2)], dts[3], count=1, environment_id=2
        )

        results = self.db.get_range(TSDBModel.project, [1], dts[0], dts[-1])
        assert results == {
            1: [
                (timestamp(dts[0]), 1),
                (timestamp(dts[1]), 3),
                (timestamp(dts[2]), 1),
                (timestamp(dts[3]), 4),
            ]
        }

        results = self.db.get_range(TSDBModel.project, [2], dts[0], dts[-1])
        assert results == {
            2: [
                (timestamp(dts[0]), 0),
                (timestamp(dts[1]), 0),
                (timestamp(dts[2]), 0),
                (timestamp(dts[3]), 4),
            ]
        }

        results = self.db.get_range(TSDBModel.project, [1, 2], dts[0], dts[-1], environment_ids=[1])
        assert results == {
            1: [
                (timestamp(dts[0]), 0),
                (timestamp(dts[1]), 1),
                (timestamp(dts[2]), 0),
                (timestamp(dts[3]), 3),
            ],
            2: [
                (timestamp(dts[0]), 0),
                (timestamp(dts[1]), 0),
                (timestamp(dts[2]), 0),
                (timestamp(dts[3]), 3),
            ],
        }

        sum_results = self.db.get_timeseries_sums(TSDBModel.project, [1, 2], dts[0], dts[-1])
        assert sum_results == {1: 9, 2: 4}

        sum_results = self.db.get_timeseries_sums(
            TSDBModel.project, [1, 2], dts[0], dts[-1], environment_id=1
        )
        assert sum_results == {1: 4, 2: 3}

        sum_results = self.db.get_timeseries_sums(
            TSDBModel.project, [1, 2], dts[0], dts[-1], environment_id=0
        )
        assert sum_results == {1: 0, 2: 0}

        self.db.merge(TSDBModel.project, 1, [2], now, environment_ids=[0, 1, 2])

        results = self.db.get_range(TSDBModel.project, [1], dts[0], dts[-1])
        assert results == {
            1: [
                (timestamp(dts[0]), 1),
                (timestamp(dts[1]), 3),
                (timestamp(dts[2]), 1),
                (timestamp(dts[3]), 8),
            ]
        }

        results = self.db.get_range(TSDBModel.project, [2], dts[0], dts[-1])
        assert results == {
            2: [
                (timestamp(dts[0]), 0),
                (timestamp(dts[1]), 0),
                (timestamp(dts[2]), 0),
                (timestamp(dts[3]), 0),
            ]
        }

        results = self.db.get_range(TSDBModel.project, [1, 2], dts[0], dts[-1], environment_ids=[1])
        assert results == {
            1: [
                (timestamp(dts[0]), 0),
                (timestamp(dts[1]), 1),
                (timestamp(dts[2]), 0),
                (timestamp(dts[3]), 6),
            ],
            2: [(timestamp(dts[i]), 0) for i in range(0, 4)],
        }

        sum_results = self.db.get_timeseries_sums(TSDBModel.project, [1, 2], dts[0], dts[-1])
        assert sum_results == {1: 13, 2: 0}

        self.db.delete([TSDBModel.project], [1, 2], dts[0], dts[-1], environment_ids=[0, 1, 2])

        sum_results = self.db.get_timeseries_sums(TSDBModel.project, [1, 2], dts[0], dts[-1])
        assert sum_results == {1: 0, 2: 0}

        sum_results = self.db.get_timeseries_sums(
            TSDBModel.project, [1, 2], dts[0], dts[-1], environment_id=1
        )
        assert sum_results == {1: 0, 2: 0}

    def test_count_distinct(self) -> None:
        now = datetime.now(timezone.utc) - timedelta(hours=4)
        dts = [now + timedelta(hours=i) for i in range(4)]

        model = TSDBModel.users_affected_by_group

        def timestamp(d):
            t = int(d.timestamp())
            return t - (t % 3600)

        self.db.record(model, 1, ("foo", "bar"), dts[0])

        self.db.record(model, 1, ("baz",), dts[1], environment_id=1)

        self.db.record_multi(((model, 1, ("foo", "bar")), (model, 2, ("bar",))), dts[2])

        self.db.record(model, 1, ("baz",), dts[2], environment_id=1)

        self.db.record(model, 2, ("foo",), dts[3])

        assert self.db.get_distinct_counts_series(model, [1], dts[0], dts[-1], rollup=3600) == {
            1: [
                (timestamp(dts[0]), 2),
                (timestamp(dts[1]), 1),
                (timestamp(dts[2]), 3),
                (timestamp(dts[3]), 0),
            ]
        }

        assert self.db.get_distinct_counts_series(model, [2], dts[0], dts[-1], rollup=3600) == {
            2: [
                (timestamp(dts[0]), 0),
                (timestamp(dts[1]), 0),
                (timestamp(dts[2]), 1),
                (timestamp(dts[3]), 1),
            ]
        }

        assert self.db.get_distinct_counts_series(
            model, [1, 2], dts[0], dts[-1], rollup=3600, environment_id=1
        ) == {
            1: [
                (timestamp(dts[0]), 0),
                (timestamp(dts[1]), 1),
                (timestamp(dts[2]), 1),
                (timestamp(dts[3]), 0),
            ],
            2: [
                (timestamp(dts[0]), 0),
                (timestamp(dts[1]), 0),
                (timestamp(dts[2]), 0),
                (timestamp(dts[3]), 0),
            ],
        }

        results = self.db.get_distinct_counts_totals(model, [1, 2], dts[0], dts[-1], rollup=3600)
        assert results == {1: 3, 2: 2}

        results = self.db.get_distinct_counts_totals(
            model, [1, 2], dts[0], dts[-1], rollup=3600, environment_id=1
        )
        assert results == {1: 1, 2: 0}

        results = self.db.get_distinct_counts_totals(
            model, [1, 2], dts[0], dts[-1], rollup=3600, environment_id=0
        )
        assert results == {1: 0, 2: 0}

        self.db.merge_distinct_counts(model, 1, [2], dts[0], environment_ids=[0, 1])

        assert self.db.get_distinct_counts_series(model, [1], dts[0], dts[-1], rollup=3600) == {
            1: [
                (timestamp(dts[0]), 2),
                (timestamp(dts[1]), 1),
                (timestamp(dts[2]), 3),
                (timestamp(dts[3]), 1),
            ]
        }

        assert self.db.get_distinct_counts_series(model, [2], dts[0], dts[-1], rollup=3600) == {
            2: [
                (timestamp(dts[0]), 0),
                (timestamp(dts[1]), 0),
                (timestamp(dts[2]), 0),
                (timestamp(dts[3]), 0),
            ]
        }

        assert self.db.get_distinct_counts_series(
            model, [1, 2], dts[0], dts[-1], rollup=3600, environment_id=1
        ) == {
            1: [
                (timestamp(dts[0]), 0),
                (timestamp(dts[1]), 1),
                (timestamp(dts[2]), 1),
                (timestamp(dts[3]), 0),
            ],
            2: [
                (timestamp(dts[0]), 0),
                (timestamp(dts[1]), 0),
                (timestamp(dts[2]), 0),
                (timestamp(dts[3]), 0),
            ],
        }

        results = self.db.get_distinct_counts_totals(model, [1, 2], dts[0], dts[-1], rollup=3600)
        assert results == {1: 3, 2: 0}

        self.db.delete_distinct_counts([model], [1, 2], dts[0], dts[-1], environment_ids=[0, 1])

        results = self.db.get_distinct_counts_totals(model, [1, 2], dts[0], dts[-1])
        assert results == {1: 0, 2: 0}

        results = self.db.get_distinct_counts_totals(
            model, [1, 2], dts[0], dts[-1], environment_id=1
        )
        assert results == {1: 0, 2: 0}
