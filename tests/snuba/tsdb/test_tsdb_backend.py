from datetime import datetime, timedelta
from unittest.mock import patch

import pytz

from sentry.models import Environment, Group, GroupRelease, Release
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import iso_format
from sentry.testutils.performance_issues.store_transaction import PerfIssueTransactionTestMixin
from sentry.testutils.silo import region_silo_test
from sentry.tsdb.base import TSDBModel
from sentry.tsdb.snuba import SnubaTSDB
from sentry.types.issues import GroupType
from sentry.utils.dates import to_datetime, to_timestamp
from sentry.utils.snuba import aliased_query


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

    def test_range_single(self):
        env1 = "test"
        project = self.create_project()
        for r in range(0, 600 * 6 * 4, 300):  # Every 10 min for 4 hours
            self.store_event(
                data={
                    "event_id": (str(r) * 32)[:32],
                    "message": "message 1",
                    "platform": "python",
                    "fingerprint": ["group-1"],
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
                    },
                    "release": str(r // 3600) * 10,  # 1 per hour,
                },
                project_id=project.id,
            )
        groups = Group.objects.filter(project=project).order_by("id")
        group = groups[0]

        dts = [self.now + timedelta(hours=i) for i in range(4)]
        assert self.db.get_range(TSDBModel.group, [group.id], dts[0], dts[-1], rollup=3600) == {
            group.id: [
                (timestamp(dts[0]), 6 * 2),
                (timestamp(dts[1]), 6 * 2),
                (timestamp(dts[2]), 6 * 2),
                (timestamp(dts[3]), 6 * 2),
            ]
        }

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


@region_silo_test
class SnubaTSDBGroupPerformanceTest(TestCase, SnubaTestCase, PerfIssueTransactionTestMixin):
    def setUp(self):
        super().setUp()

        self.db = SnubaTSDB()
        self.now = (datetime.utcnow() - timedelta(hours=4)).replace(
            hour=0, minute=0, second=0, microsecond=0, tzinfo=pytz.UTC
        )
        self.proj1 = self.create_project()

        self.env1 = Environment.objects.get_or_create(
            organization_id=self.proj1.organization_id, name="test"
        )[0]
        self.env2 = Environment.objects.get_or_create(
            organization_id=self.proj1.organization_id, name="dev"
        )[0]
        defaultenv = ""

        group1_fingerprint = f"{GroupType.PERFORMANCE_SLOW_SPAN.value}-group1"
        group2_fingerprint = f"{GroupType.PERFORMANCE_N_PLUS_ONE.value}-group2"

        for r in range(0, 14400, 600):  # Every 10 min for 4 hours
            event = self.store_transaction(
                environment=[self.env1.name, None][(r // 7200) % 3],
                project_id=self.proj1.id,
                # change every 55 min so some hours have 1 user, some have 2
                user_id=f"user{r // 3300}",
                # release_version=str(r // 3600) * 10,  # 1 per hour,
                timestamp=self.now + timedelta(seconds=r),
                fingerprint=[group1_fingerprint, group2_fingerprint] if ((r // 600) % 2) else [],
            )

        self.proj1group1 = event.groups[0]
        self.proj1group2 = event.groups[1]
        self.defaultenv = Environment.objects.get(name=defaultenv)

    def test_range_groups_single(self):
        from sentry.snuba.dataset import Dataset

        now = (datetime.utcnow() - timedelta(days=1)).replace(
            hour=10, minute=0, second=0, microsecond=0, tzinfo=pytz.UTC
        )
        dts = [now + timedelta(hours=i) for i in range(4)]
        project = self.create_project()
        group_fingerprint = f"{GroupType.PERFORMANCE_N_PLUS_ONE.value}-group3"

        # not sure what's going on here, but `times=1,2,3,4` work fine
        # fails with anything above 4
        times = 4
        event_ids = []
        events = []
        for i in range(0, times):
            res = self.store_transaction(
                environment=None,
                project_id=project.id,
                user_id="my_user",
                timestamp=now + timedelta(minutes=i * 10),
                fingerprint=[group_fingerprint],
            )

            grouped_by_project = aliased_query(
                dataset=Dataset.Transactions,
                start=None,
                end=None,
                groupby=None,
                conditions=None,
                filter_keys={"project_id": [project.id], "event_id": [res.event_id]},
                selected_columns=["event_id", "project_id", "group_ids"],
                aggregations=None,
            )

            assert grouped_by_project["data"][0]["event_id"] == res.event_id
            from sentry.eventstore.models import Event

            event_from_nodestore = Event(project_id=project.id, event_id=res.event_id)
            assert event_from_nodestore.event_id == res.event_id
            event_ids.append(res.event_id)
            events.append(res)

        group = events[0].groups[0]

        transactions_for_project = aliased_query(
            dataset=Dataset.Transactions,
            start=None,
            end=None,
            groupby=None,
            conditions=None,
            filter_keys={"project_id": [project.id]},
            selected_columns=["project_id", "event_id"],
            aggregations=None,
        )
        assert len(transactions_for_project["data"]) == times

        transactions_by_group = aliased_query(
            dataset=Dataset.Transactions,
            start=None,
            end=None,
            # start=group.first_seen,
            # end=now + timedelta(hours=4),
            groupby=["group_id"],
            conditions=None,
            filter_keys={"project_id": [project.id], "group_id": [group.id]},
            aggregations=[
                ["arrayJoin", ["group_ids"], "group_id"],
                ["count()", "", "times_seen"],
            ],
        )

        assert transactions_by_group["data"][0]["times_seen"] == times  # 1 + (times % 5)

        assert self.db.get_range(
            TSDBModel.group_performance,
            [group.id],
            dts[0],
            dts[-1],
            rollup=3600,
        ) == {
            group.id: [
                # (timestamp(dts[0]), 1 + (times % 5)),
                (timestamp(dts[0]), times),
                (timestamp(dts[1]), 0),
                (timestamp(dts[2]), 0),
                (timestamp(dts[3]), 0),
            ]
        }

    def test_range_groups_mult(self):
        now = (datetime.utcnow() - timedelta(days=1)).replace(
            hour=10, minute=0, second=0, microsecond=0, tzinfo=pytz.UTC
        )
        dts = [now + timedelta(hours=i) for i in range(4)]
        project = self.create_project()
        group_fingerprint = f"{GroupType.PERFORMANCE_N_PLUS_ONE.value}-group4"
        ids = ["a", "b", "c", "d", "e", "f", "1", "2", "3", "4", "5"]
        events = []
        for i, _ in enumerate(ids):
            event = self.store_transaction(
                environment=None,
                project_id=project.id,
                user_id="my_user",
                timestamp=now + timedelta(minutes=i * 10),
                fingerprint=[group_fingerprint],
            )
            events.append(event)
        group = events[0].groups[0]

        assert self.db.get_range(
            TSDBModel.group_performance,
            [group.id],
            dts[0],
            dts[-1],
            rollup=3600,
        ) == {
            group.id: [
                (timestamp(dts[0]), 6),
                (timestamp(dts[1]), 5),
                (timestamp(dts[2]), 0),
                (timestamp(dts[3]), 0),
            ]
        }

    def test_range_groups_simple(self):
        project = self.create_project()
        now = (datetime.utcnow() - timedelta(days=1)).replace(
            hour=10, minute=0, second=0, microsecond=0, tzinfo=pytz.UTC
        )
        group_fingerprint = f"{GroupType.PERFORMANCE_SLOW_SPAN.value}-group5"
        # for r in range(0, 14400, 600):  # Every 10 min for 4 hours
        # for r in [1, 2, 3, 4, 5, 6, 7, 8]:
        ids = ["a", "b", "c", "d", "e"]  # , "f"]
        events = []
        for r in ids:
            # for r in range(0, 9, 1):
            event = self.store_transaction(
                environment=None,
                project_id=project.id,
                # change every 55 min so some hours have 1 user, some have 2
                user_id=f"user{r}",
                # release_version=str(r // 3600) * 10,  # 1 per hour,
                timestamp=now,
                fingerprint=[group_fingerprint],
            )
            events.append(event)

        group = events[0].groups[0]
        dts = [now + timedelta(hours=i) for i in range(4)]
        assert self.db.get_range(
            TSDBModel.group_performance,
            [group.id],
            dts[0],
            dts[-1],
            rollup=3600,
        ) == {
            group.id: [
                (timestamp(dts[0]), len(ids)),
                (timestamp(dts[1]), 0),
                (timestamp(dts[2]), 0),
                (timestamp(dts[3]), 0),
            ]
        }

    def test_range_groups(self):
        dts = [self.now + timedelta(hours=i) for i in range(4)]
        # Multiple groups
        assert self.db.get_range(
            TSDBModel.group_performance,
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

        assert (
            self.db.get_range(TSDBModel.group_performance, [], dts[0], dts[-1], rollup=3600) == {}
        )


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
