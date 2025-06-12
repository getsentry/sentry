from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from snuba_sdk import Limit

from sentry.issues.grouptype import ProfileFileIOGroupType
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.models.grouprelease import GroupRelease
from sentry.models.release import Release
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.tsdb.base import TSDBModel
from sentry.tsdb.snuba import SnubaTSDB
from sentry.utils.dates import to_datetime
from tests.sentry.issues.test_utils import SearchIssueTestMixin


def timestamp(d):
    t = int(d.timestamp())
    return t - (t % 3600)


def has_shape(data, shape):
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
    """
    assert isinstance(data, type(shape))
    if isinstance(data, dict):
        return (
            len(data) > 0
            and all(has_shape(k, list(shape.keys())[0]) for k in data.keys())
            and all(has_shape(v, list(shape.values())[0]) for v in data.values())
        )
    elif isinstance(data, list):
        return len(data) > 0 and all(has_shape(v, shape[0]) for v in data)
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
        self.now = before_now(hours=4).replace(hour=0, minute=0, second=0, microsecond=0)
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
                    "timestamp": (self.now + timedelta(seconds=r)).isoformat(),
                    "tags": {
                        "foo": "bar",
                        "baz": "quux",
                        "region": ["US", "EU"][(r // 7200) % 3],
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
                    "timestamp": (self.now + timedelta(seconds=r)).isoformat(),
                    "tags": {
                        "foo": "bar",
                        "baz": "quux",
                        # Switch every 2 hours
                        "region": "US",
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
        assert self.db.get_range(
            TSDBModel.group,
            [group.id],
            dts[0],
            dts[-1],
            rollup=3600,
            tenant_ids={"referrer": "r", "organization_id": 1234},
        ) == {
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
            TSDBModel.group,
            [self.proj1group1.id],
            dts[0],
            dts[-1],
            rollup=3600,
            tenant_ids={"referrer": "r", "organization_id": 1234},
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
            tenant_ids={"referrer": "r", "organization_id": 1234},
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
            self.db.get_range(
                TSDBModel.group,
                [],
                dts[0],
                dts[-1],
                rollup=3600,
                tenant_ids={"referrer": "test", "organization_id": 1},
            )
            == {}
        )

    def test_range_releases(self):
        dts = [self.now + timedelta(hours=i) for i in range(4)]
        assert self.db.get_range(
            TSDBModel.release,
            [self.release1.id],
            dts[0],
            dts[-1],
            rollup=3600,
            tenant_ids={"referrer": "r", "organization_id": 1234},
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
            TSDBModel.project,
            [self.proj1.id],
            dts[0],
            dts[-1],
            rollup=3600,
            tenant_ids={"referrer": "r", "organization_id": 1234},
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
            tenant_ids={"referrer": "r", "organization_id": 1234},
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
            tenant_ids={"referrer": "r", "organization_id": 1234},
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
            tenant_ids={"referrer": "r", "organization_id": 1234},
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
            TSDBModel.project,
            [self.proj1.id],
            dts[0],
            dts[-1],
            rollup=86400,
            tenant_ids={"referrer": "r", "organization_id": 1234},
        ) == {self.proj1.id: [(timestamp(dts[0]), 24), (timestamp(dts[1]), 0)]}

        # Minutely
        dts = [self.now + timedelta(minutes=i) for i in range(120)]
        # Expect every 10th minute to have a 1, else 0
        expected = [(d.timestamp(), 1 if i % 10 == 0 else 0) for i, d in enumerate(dts)]

        assert self.db.get_range(
            TSDBModel.project,
            [self.proj1.id],
            dts[0],
            dts[-1],
            rollup=60,
            tenant_ids={"referrer": "r", "organization_id": 1234},
        ) == {self.proj1.id: expected}

    def test_distinct_counts_series_users(self):
        dts = [self.now + timedelta(hours=i) for i in range(4)]
        assert self.db.get_distinct_counts_series(
            TSDBModel.users_affected_by_group,
            [self.proj1group1.id],
            dts[0],
            dts[-1],
            rollup=3600,
            tenant_ids={"referrer": "r", "organization_id": 1234},
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
            TSDBModel.users_affected_by_project,
            [self.proj1.id],
            dts[0],
            dts[-1],
            rollup=3600,
            tenant_ids={"referrer": "r", "organization_id": 1234},
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
                TSDBModel.users_affected_by_group,
                [],
                dts[0],
                dts[-1],
                rollup=3600,
                tenant_ids={"referrer": "r", "organization_id": 1234},
            )
            == {}
        )

    def test_get_distinct_counts_totals_users(self):
        assert self.db.get_distinct_counts_totals(
            TSDBModel.users_affected_by_group,
            [self.proj1group1.id],
            self.now,
            self.now + timedelta(hours=4),
            rollup=3600,
            tenant_ids={"referrer": "r", "organization_id": 1234},
        ) == {
            self.proj1group1.id: 5  # 5 unique users overall
        }

        assert self.db.get_distinct_counts_totals(
            TSDBModel.users_affected_by_group,
            [self.proj1group1.id],
            self.now,
            self.now,
            rollup=3600,
            tenant_ids={"referrer": "r", "organization_id": 1234},
        ) == {
            self.proj1group1.id: 1  # Only 1 unique user in the first hour
        }

        assert self.db.get_distinct_counts_totals(
            TSDBModel.users_affected_by_project,
            [self.proj1.id],
            self.now,
            self.now + timedelta(hours=4),
            rollup=3600,
            tenant_ids={"referrer": "r", "organization_id": 1234},
        ) == {self.proj1.id: 5}

        assert (
            self.db.get_distinct_counts_totals(
                TSDBModel.users_affected_by_group,
                [],
                self.now,
                self.now + timedelta(hours=4),
                rollup=3600,
                tenant_ids={"referrer": "r", "organization_id": 1234},
            )
            == {}
        )

    def test_get_distinct_counts_totals_users__with_conditions(self):
        assert self.db.get_distinct_counts_totals(
            TSDBModel.users_affected_by_group,
            [self.proj1group1.id],
            self.now,
            self.now + timedelta(hours=4),
            rollup=3600,
            tenant_ids={"referrer": "r", "organization_id": 1234},
            conditions=[("tags[region]", "=", "US")],
        ) == {
            self.proj1group1.id: 2  # 5 unique users with US tag
        }
        assert self.db.get_distinct_counts_totals(
            TSDBModel.users_affected_by_group,
            [self.proj1group1.id],
            self.now,
            self.now + timedelta(hours=4),
            rollup=3600,
            tenant_ids={"referrer": "r", "organization_id": 1234},
            conditions=[("tags[region]", "=", "EU")],
        ) == {
            self.proj1group1.id: 3  # 3 unique users with EU tag
        }
        assert self.db.get_distinct_counts_totals(
            TSDBModel.users_affected_by_group,
            [self.proj1group1.id],
            self.now,
            self.now + timedelta(hours=4),
            rollup=3600,
            tenant_ids={"referrer": "r", "organization_id": 1234},
            conditions=[("tags[region]", "=", "MARS")],
        ) == {self.proj1group1.id: 0}
        assert (
            self.db.get_distinct_counts_totals(
                TSDBModel.users_affected_by_group,
                [],
                self.now,
                self.now + timedelta(hours=4),
                rollup=3600,
                tenant_ids={"referrer": "r", "organization_id": 1234},
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
            tenant_ids={"referrer": "r", "organization_id": 1234},
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
                TSDBModel.frequent_releases_by_group,
                {},
                dts[0],
                dts[-1],
                rollup=3600,
                tenant_ids={"referrer": "r", "organization_id": 1234},
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

        items = {
            # {project_id: (issue_id, issue_id, ...)}
            project_id: (self.proj1group1.id, self.proj1group2.id)
        }
        results1 = self.db.get_frequency_series(
            TSDBModel.frequent_issues_by_project,
            items,
            dts[0],
            dts[-1],
            tenant_ids={"referrer": "r", "organization_id": 1234},
        )
        assert has_shape(results1, {1: [(1, {1: 1})]})

        results2 = self.db.get_range(
            TSDBModel.project,
            [project_id],
            dts[0],
            dts[-1],
            tenant_ids={"referrer": "r", "organization_id": 1234},
        )
        assert has_shape(results2, {1: [(1, 1)]})

        results3 = self.db.get_distinct_counts_series(
            TSDBModel.users_affected_by_project,
            [project_id],
            dts[0],
            dts[-1],
            tenant_ids={"referrer": "r", "organization_id": 1234},
        )
        assert has_shape(results3, {1: [(1, 1)]})

        results4 = self.db.get_distinct_counts_totals(
            TSDBModel.users_affected_by_project,
            [project_id],
            dts[0],
            dts[-1],
            tenant_ids={"referrer": "r", "organization_id": 1234},
        )
        assert has_shape(results4, {1: 1})

    def test_calculated_limit(self):

        with patch("sentry.tsdb.snuba.raw_snql_query") as snuba:
            # 24h test
            rollup = 3600
            end = self.now
            start = end + timedelta(days=-1, seconds=rollup)
            self.db.get_data(TSDBModel.group, [1, 2, 3, 4, 5], start, end, rollup=rollup)

            assert snuba.call_args.args[0].query.limit == Limit(120)

            # 14 day test
            rollup = 86400
            start = end + timedelta(days=-14, seconds=rollup)
            self.db.get_data(TSDBModel.group, [1, 2, 3, 4, 5], start, end, rollup=rollup)
            assert snuba.call_args.args[0].query.limit == Limit(70)

            # 1h test
            rollup = 3600
            end = self.now
            start = end + timedelta(hours=-1, seconds=rollup)
            self.db.get_data(TSDBModel.group, [1, 2, 3, 4, 5], start, end, rollup=rollup)
            assert snuba.call_args.args[0].query.limit == Limit(5)

    @patch("sentry.utils.snuba.OVERRIDE_OPTIONS", new={"consistent": True})
    def test_tsdb_with_consistent(self):
        with patch("sentry.utils.snuba._apply_cache_and_build_results") as snuba:
            rollup = 3600
            end = self.now
            start = end + timedelta(days=-1, seconds=rollup)
            self.db.get_data(TSDBModel.group, [1, 2, 3, 4, 5], start, end, rollup=rollup)
            assert snuba.call_args.args[0][0].request.query.limit == Limit(120)
            assert snuba.call_args.args[0][0].request.flags.consistent is True


class SnubaTSDBGroupProfilingTest(TestCase, SnubaTestCase, SearchIssueTestMixin):
    def setUp(self):
        super().setUp()

        self.db = SnubaTSDB()
        self.now = before_now(hours=4).replace(hour=0, minute=0, second=0, microsecond=0)
        self.proj1 = self.create_project()

        self.env1 = Environment.objects.get_or_create(
            organization_id=self.proj1.organization_id, name="test"
        )[0]
        self.env2 = Environment.objects.get_or_create(
            organization_id=self.proj1.organization_id, name="dev"
        )[0]
        defaultenv = ""

        group1_fingerprint = f"{ProfileFileIOGroupType.type_id}-group1"
        group2_fingerprint = f"{ProfileFileIOGroupType.type_id}-group2"

        groups = {}
        for r in range(0, 14400, 600):  # Every 10 min for 4 hours
            event, occurrence, group_info = self.store_search_issue(
                project_id=self.proj1.id,
                # change every 55 min so some hours have 1 user, some have 2
                user_id=r // 3300,
                fingerprints=[group1_fingerprint] if ((r // 600) % 2) else [group2_fingerprint],
                # release_version=str(r // 3600) * 10,  # 1 per hour,
                environment=[self.env1.name, None][(r // 7200) % 3],
                insert_time=self.now + timedelta(seconds=r),
            )
            if group_info:
                groups[group_info.group.id] = group_info.group

        all_groups = list(groups.values())
        self.proj1group1 = all_groups[0]
        self.proj1group2 = all_groups[1]
        self.defaultenv = Environment.objects.get(name=defaultenv)

    def test_range_group_manual_group_time_rollup(self):
        project = self.create_project()

        # these are the only granularities/rollups that be actually be used
        GRANULARITIES = [
            (10, timedelta(seconds=10), 5),
            (60 * 60, timedelta(hours=1), 6),
            (60 * 60 * 24, timedelta(days=1), 15),
        ]

        start = before_now(days=15).replace(hour=0, minute=0, second=0)

        for step, delta, times in GRANULARITIES:
            series = [start + (delta * i) for i in range(times)]
            series_ts = [int(ts.timestamp()) for ts in series]

            assert self.db.get_optimal_rollup(series[0], series[-1]) == step

            assert self.db.get_optimal_rollup_series(series[0], end=series[-1], rollup=None) == (
                step,
                series_ts,
            )

            for time_step in series:
                _, _, group_info = self.store_search_issue(
                    project_id=project.id,
                    user_id=0,
                    fingerprints=[f"test_range_group_manual_group_time_rollup-{step}"],
                    environment=None,
                    insert_time=time_step,
                )

            assert group_info is not None
            assert self.db.get_range(
                TSDBModel.group_generic,
                [group_info.group.id],
                series[0],
                series[-1],
                rollup=None,
                tenant_ids={"referrer": "test", "organization_id": 1},
            ) == {group_info.group.id: [(ts, 1) for ts in series_ts]}

    def test_range_groups_mult(self):
        now = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        dts = [now + timedelta(hours=i) for i in range(4)]
        project = self.create_project()
        group_fingerprint = f"{ProfileFileIOGroupType.type_id}-group4"
        groups = []
        for i in range(0, 11):
            _, _, group_info = self.store_search_issue(
                project_id=project.id,
                user_id=0,
                fingerprints=[group_fingerprint],
                environment=None,
                insert_time=now + timedelta(minutes=i * 10),
            )
            if group_info:
                groups.append(group_info.group)

        group = groups[0]
        assert self.db.get_range(
            TSDBModel.group_generic,
            [group.id],
            dts[0],
            dts[-1],
            rollup=3600,
            tenant_ids={"referrer": "test", "organization_id": 1},
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
        now = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        group_fingerprint = f"{ProfileFileIOGroupType.type_id}-group5"
        ids = [1, 2, 3, 4, 5]
        groups = []
        for r in ids:
            # for r in range(0, 9, 1):
            event, occurrence, group_info = self.store_search_issue(
                project_id=project.id,
                # change every 55 min so some hours have 1 user, some have 2
                user_id=r,
                fingerprints=[group_fingerprint],
                environment=None,
                # release_version=str(r // 3600) * 10,  # 1 per hour,
                insert_time=now,
            )
            if group_info:
                groups.append(group_info.group)

        group = groups[0]
        dts = [now + timedelta(hours=i) for i in range(4)]
        assert self.db.get_range(
            TSDBModel.group_generic,
            [group.id],
            dts[0],
            dts[-1],
            rollup=3600,
            tenant_ids={"referrer": "test", "organization_id": 1},
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
            TSDBModel.group_generic,
            [self.proj1group1.id, self.proj1group2.id],
            dts[0],
            dts[-1],
            rollup=3600,
            tenant_ids={"referrer": "test", "organization_id": 1},
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
            self.db.get_range(
                TSDBModel.group_generic,
                [],
                dts[0],
                dts[-1],
                rollup=3600,
                tenant_ids={"referrer": "test", "organization_id": 1},
            )
            == {}
        )

    def test_get_distinct_counts_totals_users(self):
        assert self.db.get_distinct_counts_totals(
            TSDBModel.users_affected_by_generic_group,
            [self.proj1group1.id],
            self.now,
            self.now + timedelta(hours=4),
            rollup=3600,
            tenant_ids={"referrer": "test", "organization_id": 1},
        ) == {
            self.proj1group1.id: 5  # 5 unique users overall
        }

        assert self.db.get_distinct_counts_totals(
            TSDBModel.users_affected_by_generic_group,
            [self.proj1group1.id],
            self.now,
            self.now,
            rollup=3600,
            tenant_ids={"referrer": "test", "organization_id": 1},
        ) == {
            self.proj1group1.id: 1  # Only 1 unique user in the first hour
        }

        assert (
            self.db.get_distinct_counts_totals(
                TSDBModel.users_affected_by_generic_group,
                [],
                self.now,
                self.now + timedelta(hours=4),
                rollup=3600,
                tenant_ids={"referrer": "test", "organization_id": 1},
            )
            == {}
        )

    def test_get_sums(self):
        assert self.db.get_sums(
            model=TSDBModel.group_generic,
            keys=[self.proj1group1.id, self.proj1group2.id],
            start=self.now,
            end=self.now + timedelta(hours=4),
            tenant_ids={"referrer": "test", "organization_id": 1},
        ) == {self.proj1group1.id: 12, self.proj1group2.id: 12}

    def test_get_sums__with_conditions(self):
        assert self.db.get_sums(
            model=TSDBModel.group_generic,
            keys=[self.proj1group1.id, self.proj1group2.id],
            start=self.now,
            end=self.now + timedelta(hours=4),
            tenant_ids={"referrer": "test", "organization_id": 1},
            conditions=[("tags[environment]", "=", str(self.env1.name))],
        ) == {self.proj1group1.id: 6, self.proj1group2.id: 6}

    def test_get_data_or_conditions_parsed(self):
        """
        Verify parsing the legacy format with nested OR conditions works
        """

        conditions = [
            # or conditions in the legacy format needs open and close brackets for precedence
            # there's some special casing when parsing conditions that specifically handles this
            [
                [["isNull", ["environment"]], "=", 1],
                ["environment", "IN", [self.env1.name]],
            ]
        ]

        data1 = self.db.get_data(
            model=TSDBModel.group_generic,
            keys=[self.proj1group1.id, self.proj1group2.id],
            conditions=conditions,
            start=self.now,
            end=self.now + timedelta(hours=4),
            tenant_ids={"referrer": "test", "organization_id": 1},
        )
        data2 = self.db.get_data(
            model=TSDBModel.group_generic,
            keys=[self.proj1group1.id, self.proj1group2.id],
            start=self.now,
            end=self.now + timedelta(hours=4),
            tenant_ids={"referrer": "test", "organization_id": 1},
        )

        # the above queries should return the same data since all groups either have:
        # environment=None or environment=test
        # so the condition really shouldn't be filtering anything
        assert data1 == data2


class AddJitterToSeriesTest(TestCase):
    def setUp(self):
        self.db = SnubaTSDB()

    def run_test(self, end, interval, jitter, expected_start, expected_end):
        start = end - interval
        rollup, rollup_series = self.db.get_optimal_rollup_series(start, end)
        series = self.db._add_jitter_to_series(rollup_series, start, rollup, jitter)
        assert to_datetime(series[0]) == expected_start
        assert to_datetime(series[-1]) == expected_end

    def test(self):
        self.run_test(
            end=datetime(2022, 5, 18, 10, 23, 4, tzinfo=UTC),
            interval=timedelta(hours=1),
            jitter=5,
            expected_start=datetime(2022, 5, 18, 9, 22, 55, tzinfo=UTC),
            expected_end=datetime(2022, 5, 18, 10, 22, 55, tzinfo=UTC),
        )
        self.run_test(
            end=datetime(2022, 5, 18, 10, 23, 8, tzinfo=UTC),
            interval=timedelta(hours=1),
            jitter=5,
            expected_start=datetime(2022, 5, 18, 9, 23, 5, tzinfo=UTC),
            expected_end=datetime(2022, 5, 18, 10, 23, 5, tzinfo=UTC),
        )
        # Jitter should be the same
        self.run_test(
            end=datetime(2022, 5, 18, 10, 23, 8, tzinfo=UTC),
            interval=timedelta(hours=1),
            jitter=55,
            expected_start=datetime(2022, 5, 18, 9, 23, 5, tzinfo=UTC),
            expected_end=datetime(2022, 5, 18, 10, 23, 5, tzinfo=UTC),
        )
        self.run_test(
            end=datetime(2022, 5, 18, 22, 33, 2, tzinfo=UTC),
            interval=timedelta(minutes=1),
            jitter=3,
            expected_start=datetime(2022, 5, 18, 22, 31, 53, tzinfo=UTC),
            expected_end=datetime(2022, 5, 18, 22, 32, 53, tzinfo=UTC),
        )

    def test_empty_series(self):
        assert self.db._add_jitter_to_series([], datetime(2022, 5, 18, 10, 23, 4), 60, 127) == []
        assert self.db._add_jitter_to_series([], datetime(2022, 5, 18, 10, 23, 4), 60, None) == []
