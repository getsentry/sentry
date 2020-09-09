from __future__ import absolute_import

import pytest
import pytz

from contextlib import contextmanager
from datetime import datetime, timedelta

from sentry.testutils import TestCase
from sentry.tsdb.base import TSDBModel, ONE_MINUTE, ONE_HOUR, ONE_DAY
from sentry.tsdb.redis import RedisTSDB, CountMinScript, SuppressionWrapper
from sentry.utils.dates import to_datetime, to_timestamp


def test_suppression_wrapper():
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
            hosts={i - 6: {"db": i} for i in range(6, 9)},
        )

    def tearDown(self):
        with self.db.cluster.all() as client:
            client.flushdb()

    def test_make_counter_key(self):
        result = self.db.make_counter_key(TSDBModel.project, 1, to_datetime(1368889980), 1, None)
        assert result == ("ts:1:1368889980:1", 1)

        result = self.db.make_counter_key(
            TSDBModel.project, 1, to_datetime(1368889980), "foo", None
        )
        assert result == ("ts:1:1368889980:46", self.db.get_model_key("foo"))

        result = self.db.make_counter_key(TSDBModel.project, 1, to_datetime(1368889980), 1, 1)
        assert result == ("ts:1:1368889980:1", "1?e=1")

        result = self.db.make_counter_key(TSDBModel.project, 1, to_datetime(1368889980), "foo", 1)
        assert result == ("ts:1:1368889980:46", self.db.get_model_key("foo") + "?e=1")

    def test_get_model_key(self):
        result = self.db.get_model_key(1)
        assert result == 1

        result = self.db.get_model_key("foo")
        assert result == "bf4e529197e56a48ae2737505b9736e4"

    def test_simple(self):
        now = datetime.utcnow().replace(tzinfo=pytz.UTC) - timedelta(hours=4)
        dts = [now + timedelta(hours=i) for i in range(4)]

        def timestamp(d):
            t = int(to_timestamp(d))
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

        results = self.db.get_sums(TSDBModel.project, [1, 2], dts[0], dts[-1])
        assert results == {1: 9, 2: 4}

        results = self.db.get_sums(TSDBModel.project, [1, 2], dts[0], dts[-1], environment_id=1)
        assert results == {1: 4, 2: 3}

        results = self.db.get_sums(TSDBModel.project, [1, 2], dts[0], dts[-1], environment_id=0)
        assert results == {1: 0, 2: 0}

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

        results = self.db.get_sums(TSDBModel.project, [1, 2], dts[0], dts[-1])
        assert results == {1: 13, 2: 0}

        self.db.delete([TSDBModel.project], [1, 2], dts[0], dts[-1], environment_ids=[0, 1, 2])

        results = self.db.get_sums(TSDBModel.project, [1, 2], dts[0], dts[-1])
        assert results == {1: 0, 2: 0}

        results = self.db.get_sums(TSDBModel.project, [1, 2], dts[0], dts[-1], environment_id=1)
        assert results == {1: 0, 2: 0}

    def test_count_distinct(self):
        now = datetime.utcnow().replace(tzinfo=pytz.UTC) - timedelta(hours=4)
        dts = [now + timedelta(hours=i) for i in range(4)]

        model = TSDBModel.users_affected_by_group

        def timestamp(d):
            t = int(to_timestamp(d))
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

        assert self.db.get_distinct_counts_union(model, [], dts[0], dts[-1], rollup=3600) == 0
        assert self.db.get_distinct_counts_union(model, [1, 2], dts[0], dts[-1], rollup=3600) == 3
        assert (
            self.db.get_distinct_counts_union(
                model, [1, 2], dts[0], dts[-1], rollup=3600, environment_id=1
            )
            == 1
        )
        assert (
            self.db.get_distinct_counts_union(
                model, [1, 2], dts[0], dts[-1], rollup=3600, environment_id=0
            )
            == 0
        )

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

        assert self.db.get_distinct_counts_union(model, [], dts[0], dts[-1], rollup=3600) == 0
        assert self.db.get_distinct_counts_union(model, [1], dts[0], dts[-1], rollup=3600) == 3
        assert self.db.get_distinct_counts_union(model, [1, 2], dts[0], dts[-1], rollup=3600) == 3
        assert self.db.get_distinct_counts_union(model, [2], dts[0], dts[-1], rollup=3600) == 0

        self.db.delete_distinct_counts([model], [1, 2], dts[0], dts[-1], environment_ids=[0, 1])

        results = self.db.get_distinct_counts_totals(model, [1, 2], dts[0], dts[-1])
        assert results == {1: 0, 2: 0}

        results = self.db.get_distinct_counts_totals(
            model, [1, 2], dts[0], dts[-1], environment_id=1
        )
        assert results == {1: 0, 2: 0}

    def test_frequency_tables(self):
        now = datetime.utcnow().replace(tzinfo=pytz.UTC)
        model = TSDBModel.frequent_issues_by_project

        # None of the registered frequency tables actually support
        # environments, so we have to pretend like one actually does
        self.db.models_with_environment_support = self.db.models_with_environment_support | set(
            [model]
        )

        rollup = 3600

        self.db.record_frequency_multi(
            ((model, {"organization:1": {"project:1": 1, "project:2": 2, "project:3": 3}}),), now
        )

        self.db.record_frequency_multi(
            (
                (
                    model,
                    {
                        "organization:1": {
                            "project:1": 1,
                            "project:2": 1,
                            "project:3": 1,
                            "project:4": 1,
                        },
                        "organization:2": {"project:5": 1},
                    },
                ),
            ),
            now - timedelta(hours=1),
        )

        self.db.record_frequency_multi(
            (
                (
                    model,
                    {
                        "organization:1": {"project:2": 1, "project:3": 2, "project:4": 3},
                        "organization:2": {"project:5": 0.5},
                    },
                ),
            ),
            now - timedelta(hours=1),
            environment_id=1,
        )

        assert self.db.get_most_frequent(
            model, ("organization:1", "organization:2"), now, rollup=rollup
        ) == {
            "organization:1": [("project:3", 3.0), ("project:2", 2.0), ("project:1", 1.0)],
            "organization:2": [],
        }

        assert self.db.get_most_frequent(
            model,
            ("organization:1", "organization:2"),
            now - timedelta(hours=1),
            now,
            rollup=rollup,
            environment_id=1,
        ) == {
            "organization:1": [("project:4", 3.0), ("project:3", 2.0), ("project:2", 1.0)],
            "organization:2": [("project:5", 0.5)],
        }

        assert self.db.get_most_frequent(
            model, ("organization:1", "organization:2"), now, limit=1, rollup=rollup
        ) == {"organization:1": [("project:3", 3.0)], "organization:2": []}

        assert self.db.get_most_frequent(
            model,
            ("organization:1", "organization:2"),
            now - timedelta(hours=1),
            now,
            rollup=rollup,
        ) == {
            "organization:1": [
                ("project:3", 3.0 + 3.0),
                ("project:2", 2.0 + 2.0),
                ("project:4", 4.0),
                ("project:1", 1.0 + 1.0),
            ],
            "organization:2": [("project:5", 1.5)],
        }

        assert self.db.get_most_frequent(
            model,
            ("organization:1", "organization:2"),
            now - timedelta(hours=1),
            now,
            rollup=rollup,
            environment_id=0,
        ) == {"organization:1": [], "organization:2": []}

        timestamp = int(to_timestamp(now) // rollup) * rollup

        assert self.db.get_most_frequent_series(
            model,
            ("organization:1", "organization:2", "organization:3"),
            now - timedelta(hours=1),
            now,
            rollup=rollup,
        ) == {
            "organization:1": [
                (
                    timestamp - rollup,
                    {"project:1": 1.0, "project:2": 2.0, "project:3": 3.0, "project:4": 4.0},
                ),
                (timestamp, {"project:1": 1.0, "project:2": 2.0, "project:3": 3.0}),
            ],
            "organization:2": [(timestamp - rollup, {"project:5": 1.5}), (timestamp, {})],
            "organization:3": [(timestamp - rollup, {}), (timestamp, {})],
        }

        assert self.db.get_frequency_series(
            model,
            {
                "organization:1": ("project:1", "project:2", "project:3", "project:4"),
                "organization:2": ("project:5",),
            },
            now - timedelta(hours=1),
            now,
            rollup=rollup,
        ) == {
            "organization:1": [
                (
                    timestamp - rollup,
                    {"project:1": 1.0, "project:2": 2.0, "project:3": 3.0, "project:4": 4.0},
                ),
                (
                    timestamp,
                    {"project:1": 1.0, "project:2": 2.0, "project:3": 3.0, "project:4": 0.0},
                ),
            ],
            "organization:2": [
                (timestamp - rollup, {"project:5": 1.5}),
                (timestamp, {"project:5": 0.0}),
            ],
        }

        assert self.db.get_frequency_series(
            model,
            {
                "organization:1": ("project:1", "project:2", "project:3", "project:4"),
                "organization:2": ("project:5",),
            },
            now - timedelta(hours=1),
            now,
            rollup=rollup,
            environment_id=1,
        ) == {
            "organization:1": [
                (
                    timestamp - rollup,
                    {"project:1": 0.0, "project:2": 1.0, "project:3": 2.0, "project:4": 3.0},
                ),
                (
                    timestamp,
                    {"project:1": 0.0, "project:2": 0.0, "project:3": 0.0, "project:4": 0.0},
                ),
            ],
            "organization:2": [
                (timestamp - rollup, {"project:5": 0.5}),
                (timestamp, {"project:5": 0.0}),
            ],
        }

        assert self.db.get_frequency_totals(
            model,
            {
                "organization:1": ("project:1", "project:2", "project:3", "project:4", "project:5"),
                "organization:2": ("project:1", "project:2", "project:3", "project:4", "project:5"),
            },
            now - timedelta(hours=1),
            now,
            rollup=rollup,
        ) == {
            "organization:1": {
                "project:1": 1.0 + 1.0,
                "project:2": 2.0 + 2.0,
                "project:3": 3.0 + 3.0,
                "project:4": 4.0,
                "project:5": 0.0,
            },
            "organization:2": {
                "project:1": 0.0,
                "project:2": 0.0,
                "project:3": 0.0,
                "project:4": 0.0,
                "project:5": 1.5,
            },
        }

        self.db.merge_frequencies(
            model, "organization:1", ["organization:2"], now, environment_ids=[0, 1]
        )

        assert self.db.get_frequency_totals(
            model,
            {
                "organization:1": ("project:1", "project:2", "project:3", "project:4", "project:5"),
                "organization:2": ("project:1", "project:2", "project:3", "project:4", "project:5"),
            },
            now - timedelta(hours=1),
            now,
            rollup=rollup,
        ) == {
            "organization:1": {
                "project:1": 1.0 + 1.0,
                "project:2": 2.0 + 2.0,
                "project:3": 3.0 + 3.0,
                "project:4": 4.0,
                "project:5": 1.5,
            },
            "organization:2": {
                "project:1": 0.0,
                "project:2": 0.0,
                "project:3": 0.0,
                "project:4": 0.0,
                "project:5": 0.0,
            },
        }

        assert self.db.get_frequency_totals(
            model,
            {
                "organization:1": ("project:1", "project:2", "project:3", "project:4", "project:5"),
                "organization:2": ("project:1", "project:2", "project:3", "project:4", "project:5"),
            },
            now - timedelta(hours=1),
            now,
            rollup=rollup,
            environment_id=1,
        ) == {
            "organization:1": {
                "project:1": 0.0,
                "project:2": 1.0,
                "project:3": 2.0,
                "project:4": 3.0,
                "project:5": 0.5,
            },
            "organization:2": {
                "project:1": 0.0,
                "project:2": 0.0,
                "project:3": 0.0,
                "project:4": 0.0,
                "project:5": 0.0,
            },
        }

        self.db.delete_frequencies(
            [model],
            ["organization:1", "organization:2"],
            now - timedelta(hours=1),
            now,
            environment_ids=[0, 1],
        )

        assert self.db.get_most_frequent(model, ("organization:1", "organization:2"), now) == {
            "organization:1": [],
            "organization:2": [],
        }

        assert self.db.get_most_frequent(
            model, ("organization:1", "organization:2"), now, environment_id=1
        ) == {"organization:1": [], "organization:2": []}

    def test_frequency_table_import_export_no_estimators(self):
        client = self.db.cluster.get_local_client_for_key("key")

        parameters = [64, 5, 10]

        CountMinScript(
            ["1:i", "1:e"], ["INCR"] + parameters + [1, "foo", 2, "bar", 3, "baz"], client=client
        )

        CountMinScript(
            ["2:i", "2:e"],
            ["INCR"]
            + parameters
            + [
                1,
                "alpha",
                2,
                "beta",
                3,
                "gamma",
                4,
                "delta",
                5,
                "epsilon",
                6,
                "zeta",
                7,
                "eta",
                8,
                "theta",
                9,
                "iota",
            ],
            client=client,
        )

        assert client.exists("1:i")
        assert not client.exists("1:e")
        assert client.exists("2:i")
        assert not client.exists("2:e")

        exports = CountMinScript(["2:i", "2:e"], ["EXPORT"] + parameters, client=client)

        assert len(exports) == 1

        CountMinScript(["1:i", "1:e"], ["IMPORT"] + parameters + [exports[0]], client=client)

        assert client.exists("1:i")
        assert client.exists("1:e")

    def test_frequency_table_import_export_both_estimators(self):
        client = self.db.cluster.get_local_client_for_key("key")

        parameters = [64, 5, 5]

        CountMinScript(
            ["1:i", "1:e"],
            ["INCR"]
            + parameters
            + [1, "foo", 2, "bar", 3, "baz", 4, "wilco", 5, "tango", 6, "foxtrot"],
            client=client,
        )

        CountMinScript(
            ["2:i", "2:e"],
            ["INCR"]
            + parameters
            + [
                1,
                "alpha",
                2,
                "beta",
                3,
                "gamma",
                4,
                "delta",
                5,
                "epsilon",
                6,
                "zeta",
                7,
                "eta",
                8,
                "theta",
                9,
                "iota",
            ],
            client=client,
        )

        assert client.exists("1:i")
        assert client.exists("1:e")
        assert client.exists("2:i")
        assert client.exists("2:e")

        exports = CountMinScript(["2:i", "2:e"], ["EXPORT"] + parameters, client=client)

        assert len(exports) == 1

        CountMinScript(["1:i", "1:e"], ["IMPORT"] + parameters + [exports[0]], client=client)

        assert client.exists("1:i")
        assert client.exists("1:e")

        assert CountMinScript(["1:i", "1:e"], ["RANKED"] + parameters, client=client) == [
            [b"iota", b"9"],
            [b"theta", b"8"],
            [b"eta", b"7"],
            [b"zeta", b"6"],
            [b"foxtrot", b"6"],
        ]

    def test_frequency_table_import_export_source_estimators(self):
        client = self.db.cluster.get_local_client_for_key("key")

        parameters = [64, 5, 5]

        CountMinScript(
            ["1:i", "1:e"], ["INCR"] + parameters + [5, "foo", 7, "bar", 9, "baz"], client=client
        )

        CountMinScript(
            ["2:i", "2:e"],
            ["INCR"]
            + parameters
            + [
                1,
                "alpha",
                2,
                "beta",
                3,
                "gamma",
                4,
                "delta",
                5,
                "epsilon",
                6,
                "zeta",
                7,
                "eta",
                8,
                "theta",
                9,
                "iota",
            ],
            client=client,
        )

        assert client.exists("1:i")
        assert not client.exists("1:e")
        assert client.exists("2:i")
        assert client.exists("2:e")

        exports = CountMinScript(["2:i", "2:e"], ["EXPORT"] + parameters, client=client)

        assert len(exports) == 1

        CountMinScript(["1:i", "1:e"], ["IMPORT"] + parameters + [exports[0]], client=client)

        assert client.exists("1:i")
        assert client.exists("1:e")

        assert CountMinScript(["1:i", "1:e"], ["RANKED"] + parameters, client=client) == [
            [b"iota", b"9"],
            [b"baz", b"9"],
            [b"theta", b"8"],
            [b"eta", b"7"],
            [b"bar", b"7"],
        ]

    def test_frequency_table_import_export_destination_estimators(self):
        client = self.db.cluster.get_local_client_for_key("key")

        parameters = [64, 5, 5]

        CountMinScript(
            ["1:i", "1:e"],
            ["INCR"]
            + parameters
            + [
                1,
                "alpha",
                2,
                "beta",
                3,
                "gamma",
                4,
                "delta",
                5,
                "epsilon",
                6,
                "zeta",
                7,
                "eta",
                8,
                "theta",
                9,
                "iota",
            ],
            client=client,
        )

        CountMinScript(
            ["2:i", "2:e"], ["INCR"] + parameters + [5, "foo", 7, "bar", 9, "baz"], client=client
        )

        assert client.exists("1:i")
        assert client.exists("1:e")
        assert client.exists("2:i")
        assert not client.exists("2:e")

        exports = CountMinScript(["2:i", "2:e"], ["EXPORT"] + parameters, client=client)

        assert len(exports) == 1

        CountMinScript(["1:i", "1:e"], ["IMPORT"] + parameters + [exports[0]], client=client)

        assert client.exists("1:i")
        assert client.exists("1:e")

        assert CountMinScript(["1:i", "1:e"], ["RANKED"] + parameters, client=client) == [
            [b"iota", b"9"],
            [b"baz", b"9"],
            [b"theta", b"8"],
            [b"eta", b"7"],
            [b"bar", b"7"],
        ]
