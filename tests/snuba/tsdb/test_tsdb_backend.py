from datetime import datetime, timedelta
from unittest.mock import patch

import pytz

from sentry.models import Environment, Group, GroupRelease, Release
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import iso_format
from sentry.tsdb.base import TSDBModel
from sentry.tsdb.snuba import SnubaTSDB
from sentry.utils.dates import to_datetime, to_timestamp


def timestamp(d):
    t = int(to_timestamp(d))
    return t - (t % 3600)


def has_shape(data, shape, allow_empty=False):
    """
    Determine if a data object has the provided shape

    At any level, the object in `data` and in `shape` must have the same type.
    A dict is the same shape if all its keys and values have the same shape as the
    key/value in `shape`. The number of keys/values is not relevant.
    A list is the same shape if all its items have the same shape as the value
    in `shape`
    A tuple is the same shape if it has the same length as `shape` and all the
    values have the same shape as the corresponding value in `shape`
    Any other object simply has to have the same type.
    If `allow_empty` is set, lists and dicts in `data` will pass even if they are empty.
    """
    if not isinstance(data, type(shape)):
        return False
    if isinstance(data, dict):
        return (
            (allow_empty or len(data) > 0)
            and all(has_shape(k, list(shape.keys())[0]) for k in data.keys())
            and all(has_shape(v, list(shape.values())[0]) for v in data.values())
        )
    elif isinstance(data, list):
        return (allow_empty or len(data) > 0) and all(has_shape(v, shape[0]) for v in data)
    elif isinstance(data, tuple):
        return len(data) == len(shape) and all(
            has_shape(data[i], shape[i]) for i in range(len(data))
        )
    else:
        return True


class SnubaTSDBTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()

        self.db = SnubaTSDB()
        self.now = (datetime.utcnow() - timedelta(hours=4)).replace(
            hour=0, minute=0, second=0, microsecond=0, tzinfo=pytz.UTC
        )
        self.proj1 = self.create_project()
        env1 = "test"
        env2 = "dev"
        defaultenv = ""

        release1 = "1" * 10
        release2 = "2" * 10

        self.release1 = Release.objects.create(
            organization_id=self.organization.id, version=release1, date_added=self.now
        )
        self.release1.add_project(self.proj1)
        self.release2 = Release.objects.create(
            organization_id=self.organization.id, version=release2, date_added=self.now
        )
        self.release2.add_project(self.proj1)

        for r in range(0, 14400, 600):  # Every 10 min for 4 hours
            self.store_event(
                data={
                    "event_id": (str(r) * 32)[:32],
                    "message": "message 1",
                    "platform": "python",
                    "fingerprint": [["group-1"], ["group-2"]][
                        (r // 600) % 2
                    ],  # Switch every 10 mins
                    "timestamp": iso_format(self.now + timedelta(seconds=r)),
                    "tags": {
                        "foo": "bar",
                        "baz": "quux",
                        # Switch every 2 hours
                        "environment": [env1, None][(r // 7200) % 3],
                        "sentry:user": f"id:user{r // 3300}",
                    },
                    "user": {
                        # change every 55 min so some hours have 1 user, some have 2
                        "id": f"user{r // 3300}",
                        "email": f"user{r}@sentry.io",
                    },
                    "release": str(r // 3600) * 10,  # 1 per hour,
                },
                project_id=self.proj1.id,
            )

        groups = Group.objects.filter(project=self.proj1).order_by("id")
        self.proj1group1 = groups[0]
        self.proj1group2 = groups[1]

        self.env1 = Environment.objects.get(name=env1)
        self.env2 = self.create_environment(name=env2)  # No events
        self.defaultenv = Environment.objects.get(name=defaultenv)

        self.group1release1env1 = GroupRelease.objects.get(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            release_id=self.release1.id,
            environment=env1,
        )

        self.group1release2env1 = GroupRelease.objects.create(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            release_id=self.release2.id,
            environment=env1,
        )

        self.group2release1env1 = GroupRelease.objects.get(
            project_id=self.proj1.id,
            group_id=self.proj1group2.id,
            release_id=self.release1.id,
            environment=env1,
        )

    def test_range_groups(self):
        dts = [self.now + timedelta(hours=i) for i in range(4)]
        assert self.db.get_range(
            TSDBModel.group, [self.proj1group1.id], dts[0], dts[-1], rollup=3600
        ) == {
            self.proj1group1.id: [
                (timestamp(dts[0]), 3),
                (timestamp(dts[1]), 3),
                (timestamp(dts[2]), 3),
                (timestamp(dts[3]), 3),
            ]
        }

        # Multiple groups
        assert self.db.get_range(
            TSDBModel.group,
            [self.proj1group1.id, self.proj1group2.id],
            dts[0],
            dts[-1],
            rollup=3600,
        ) == {
            self.proj1group1.id: [
                (timestamp(dts[0]), 3),
                (timestamp(dts[1]), 3),
                (timestamp(dts[2]), 3),
                (timestamp(dts[3]), 3),
            ],
            self.proj1group2.id: [
                (timestamp(dts[0]), 3),
                (timestamp(dts[1]), 3),
                (timestamp(dts[2]), 3),
                (timestamp(dts[3]), 3),
            ],
        }

        assert self.db.get_range(TSDBModel.group, [], dts[0], dts[-1], rollup=3600) == {}

    def test_range_releases(self):
        dts = [self.now + timedelta(hours=i) for i in range(4)]
        assert self.db.get_range(
            TSDBModel.release, [self.release1.id], dts[0], dts[-1], rollup=3600
        ) == {
            self.release1.id: [
                (timestamp(dts[0]), 0),
                (timestamp(dts[1]), 6),
                (timestamp(dts[2]), 0),
                (timestamp(dts[3]), 0),
            ]
        }

    def test_range_project(self):
        dts = [self.now + timedelta(hours=i) for i in range(4)]
        assert self.db.get_range(
            TSDBModel.project, [self.proj1.id], dts[0], dts[-1], rollup=3600
        ) == {
            self.proj1.id: [
                (timestamp(dts[0]), 6),
                (timestamp(dts[1]), 6),
                (timestamp(dts[2]), 6),
                (timestamp(dts[3]), 6),
            ]
        }

    def test_range_environment_filter(self):
        dts = [self.now + timedelta(hours=i) for i in range(4)]
        assert self.db.get_range(
            TSDBModel.project,
            [self.proj1.id],
            dts[0],
            dts[-1],
            rollup=3600,
            environment_ids=[self.env1.id],
        ) == {
            self.proj1.id: [
                (timestamp(dts[0]), 6),
                (timestamp(dts[1]), 6),
                (timestamp(dts[2]), 0),
                (timestamp(dts[3]), 0),
            ]
        }

        # No events submitted for env2
        assert self.db.get_range(
            TSDBModel.project,
            [self.proj1.id],
            dts[0],
            dts[-1],
            rollup=3600,
            environment_ids=[self.env2.id],
        ) == {
            self.proj1.id: [
                (timestamp(dts[0]), 0),
                (timestamp(dts[1]), 0),
                (timestamp(dts[2]), 0),
                (timestamp(dts[3]), 0),
            ]
        }

        # Events submitted with no environment should match default environment
        assert self.db.get_range(
            TSDBModel.project,
            [self.proj1.id],
            dts[0],
            dts[-1],
            rollup=3600,
            environment_ids=[self.defaultenv.id],
        ) == {
            self.proj1.id: [
                (timestamp(dts[0]), 0),
                (timestamp(dts[1]), 0),
                (timestamp(dts[2]), 6),
                (timestamp(dts[3]), 6),
            ]
        }

    def test_range_rollups(self):
        # Daily
        daystart = self.now.replace(hour=0)  # day buckets start on day boundaries
        dts = [daystart + timedelta(days=i) for i in range(2)]
        assert self.db.get_range(
            TSDBModel.project, [self.proj1.id], dts[0], dts[-1], rollup=86400
        ) == {self.proj1.id: [(timestamp(dts[0]), 24), (timestamp(dts[1]), 0)]}

        # Minutely
        dts = [self.now + timedelta(minutes=i) for i in range(120)]
        # Expect every 10th minute to have a 1, else 0
        expected = [(to_timestamp(d), 1 if i % 10 == 0 else 0) for i, d in enumerate(dts)]

        assert self.db.get_range(
            TSDBModel.project, [self.proj1.id], dts[0], dts[-1], rollup=60
        ) == {self.proj1.id: expected}

    def test_distinct_counts_series_users(self):
        dts = [self.now + timedelta(hours=i) for i in range(4)]
        assert self.db.get_distinct_counts_series(
            TSDBModel.users_affected_by_group, [self.proj1group1.id], dts[0], dts[-1], rollup=3600
        ) == {
            self.proj1group1.id: [
                (timestamp(dts[0]), 1),
                (timestamp(dts[1]), 1),
                (timestamp(dts[2]), 1),
                (timestamp(dts[3]), 2),
            ]
        }

        dts = [self.now + timedelta(hours=i) for i in range(4)]
        assert self.db.get_distinct_counts_series(
            TSDBModel.users_affected_by_project, [self.proj1.id], dts[0], dts[-1], rollup=3600
        ) == {
            self.proj1.id: [
                (timestamp(dts[0]), 1),
                (timestamp(dts[1]), 2),
                (timestamp(dts[2]), 2),
                (timestamp(dts[3]), 2),
            ]
        }

        assert (
            self.db.get_distinct_counts_series(
                TSDBModel.users_affected_by_group, [], dts[0], dts[-1], rollup=3600
            )
            == {}
        )

    def get_distinct_counts_totals_users(self):
        assert self.db.get_distinct_counts_totals(
            TSDBModel.users_affected_by_group,
            [self.proj1group1.id],
            self.now,
            self.now + timedelta(hours=4),
            rollup=3600,
        ) == {
            self.proj1group1.id: 2  # 2 unique users overall
        }

        assert self.db.get_distinct_counts_totals(
            TSDBModel.users_affected_by_group,
            [self.proj1group1.id],
            self.now,
            self.now,
            rollup=3600,
        ) == {
            self.proj1group1.id: 1  # Only 1 unique user in the first hour
        }

        assert self.db.get_distinct_counts_totals(
            TSDBModel.users_affected_by_project,
            [self.proj1.id],
            self.now,
            self.now + timedelta(hours=4),
            rollup=3600,
        ) == {self.proj1.id: 2}

        assert (
            self.db.get_distinct_counts_totals(
                TSDBModel.users_affected_by_group,
                [],
                self.now,
                self.now + timedelta(hours=4),
                rollup=3600,
            )
            == {}
        )

    def test_most_frequent(self):
        assert self.db.get_most_frequent(
            TSDBModel.frequent_issues_by_project,
            [self.proj1.id],
            self.now,
            self.now + timedelta(hours=4),
            rollup=3600,
        ) in [
            {self.proj1.id: [(self.proj1group1.id, 2.0), (self.proj1group2.id, 1.0)]},
            {self.proj1.id: [(self.proj1group2.id, 2.0), (self.proj1group1.id, 1.0)]},
        ]  # Both issues equally frequent

        assert (
            self.db.get_most_frequent(
                TSDBModel.frequent_issues_by_project,
                [],
                self.now,
                self.now + timedelta(hours=4),
                rollup=3600,
            )
            == {}
        )

    def test_frequency_series(self):
        dts = [self.now + timedelta(hours=i) for i in range(4)]
        assert self.db.get_frequency_series(
            TSDBModel.frequent_releases_by_group,
            {
                self.proj1group1.id: (self.group1release1env1.id, self.group1release2env1.id),
                self.proj1group2.id: (self.group2release1env1.id,),
            },
            dts[0],
            dts[-1],
            rollup=3600,
        ) == {
            self.proj1group1.id: [
                (timestamp(dts[0]), {self.group1release1env1.id: 0, self.group1release2env1.id: 0}),
                (timestamp(dts[1]), {self.group1release1env1.id: 3, self.group1release2env1.id: 0}),
                (timestamp(dts[2]), {self.group1release1env1.id: 0, self.group1release2env1.id: 3}),
                (timestamp(dts[3]), {self.group1release1env1.id: 0, self.group1release2env1.id: 0}),
            ],
            self.proj1group2.id: [
                (timestamp(dts[0]), {self.group2release1env1.id: 0}),
                (timestamp(dts[1]), {self.group2release1env1.id: 3}),
                (timestamp(dts[2]), {self.group2release1env1.id: 0}),
                (timestamp(dts[3]), {self.group2release1env1.id: 0}),
            ],
        }

        assert (
            self.db.get_frequency_series(
                TSDBModel.frequent_releases_by_group, {}, dts[0], dts[-1], rollup=3600
            )
            == {}
        )

    def test_result_shape(self):
        """
        Tests that the results from the different TSDB methods have the
        expected format.
        """
        project_id = self.proj1.id
        dts = [self.now + timedelta(hours=i) for i in range(4)]

        results = self.db.get_most_frequent(
            TSDBModel.frequent_issues_by_project, [project_id], dts[0], dts[0]
        )
        assert has_shape(results, {1: [(1, 1.0)]})

        results = self.db.get_most_frequent_series(
            TSDBModel.frequent_issues_by_project, [project_id], dts[0], dts[0]
        )
        assert has_shape(results, {1: [(1, {1: 1.0})]})

        items = {
            # {project_id: (issue_id, issue_id, ...)}
            project_id: (self.proj1group1.id, self.proj1group2.id)
        }
        results = self.db.get_frequency_series(
            TSDBModel.frequent_issues_by_project, items, dts[0], dts[-1]
        )
        assert has_shape(results, {1: [(1, {1: 1})]})

        results = self.db.get_frequency_totals(
            TSDBModel.frequent_issues_by_project, items, dts[0], dts[-1]
        )
        assert has_shape(results, {1: {1: 1}})

        results = self.db.get_range(TSDBModel.project, [project_id], dts[0], dts[-1])
        assert has_shape(results, {1: [(1, 1)]})

        results = self.db.get_distinct_counts_series(
            TSDBModel.users_affected_by_project, [project_id], dts[0], dts[-1]
        )
        assert has_shape(results, {1: [(1, 1)]})

        results = self.db.get_distinct_counts_totals(
            TSDBModel.users_affected_by_project, [project_id], dts[0], dts[-1]
        )
        assert has_shape(results, {1: 1})

        results = self.db.get_distinct_counts_union(
            TSDBModel.users_affected_by_project, [project_id], dts[0], dts[-1]
        )
        assert has_shape(results, 1)

    def test_calculated_limit(self):

        with patch("sentry.tsdb.snuba.snuba") as snuba:
            # 24h test
            rollup = 3600
            end = self.now
            start = end + timedelta(days=-1, seconds=rollup)
            self.db.get_data(TSDBModel.group, [1, 2, 3, 4, 5], start, end, rollup=rollup)
            assert snuba.query.call_args[1]["limit"] == 120

            # 14 day test
            rollup = 86400
            start = end + timedelta(days=-14, seconds=rollup)
            self.db.get_data(TSDBModel.group, [1, 2, 3, 4, 5], start, end, rollup=rollup)
            assert snuba.query.call_args[1]["limit"] == 70

            # 1h test
            rollup = 3600
            end = self.now
            start = end + timedelta(hours=-1, seconds=rollup)
            self.db.get_data(TSDBModel.group, [1, 2, 3, 4, 5], start, end, rollup=rollup)
            assert snuba.query.call_args[1]["limit"] == 5


class AddJitterToSeriesTest(TestCase):
    def setUp(self):
        self.db = SnubaTSDB()

    def run_test(self, end, interval, jitter, expected_start, expected_end):
        end = end.replace(tzinfo=pytz.UTC)
        start = end - interval
        rollup, rollup_series = self.db.get_optimal_rollup_series(start, end)
        series = self.db._add_jitter_to_series(rollup_series, start, rollup, jitter)
        assert to_datetime(series[0]) == expected_start.replace(tzinfo=pytz.UTC)
        assert to_datetime(series[-1]) == expected_end.replace(tzinfo=pytz.UTC)

    def test(self):
        self.run_test(
            end=datetime(2022, 5, 18, 10, 23, 4),
            interval=timedelta(hours=1),
            jitter=5,
            expected_start=datetime(2022, 5, 18, 9, 22, 55),
            expected_end=datetime(2022, 5, 18, 10, 22, 55),
        )
        self.run_test(
            end=datetime(2022, 5, 18, 10, 23, 8),
            interval=timedelta(hours=1),
            jitter=5,
            expected_start=datetime(2022, 5, 18, 9, 23, 5),
            expected_end=datetime(2022, 5, 18, 10, 23, 5),
        )
        # Jitter should be the same
        self.run_test(
            end=datetime(2022, 5, 18, 10, 23, 8),
            interval=timedelta(hours=1),
            jitter=55,
            expected_start=datetime(2022, 5, 18, 9, 23, 5),
            expected_end=datetime(2022, 5, 18, 10, 23, 5),
        )
        self.run_test(
            end=datetime(2022, 5, 18, 22, 33, 2),
            interval=timedelta(minutes=1),
            jitter=3,
            expected_start=datetime(2022, 5, 18, 22, 31, 53),
            expected_end=datetime(2022, 5, 18, 22, 32, 53),
        )

    def test_empty_series(self):
        assert self.db._add_jitter_to_series([], datetime(2022, 5, 18, 10, 23, 4), 60, 127) == []
        assert self.db._add_jitter_to_series([], datetime(2022, 5, 18, 10, 23, 4), 60, None) == []
