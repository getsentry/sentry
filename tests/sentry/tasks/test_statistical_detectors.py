from datetime import datetime, timedelta, timezone
from typing import List
from unittest import mock

import pytest
from django.db.models import F

from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.seer.utils import BreakpointData
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.discover import zerofill
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.statistical_detectors.detector import DetectorPayload, TrendType
from sentry.tasks.statistical_detectors import (
    detect_function_change_points,
    detect_function_trends,
    detect_transaction_change_points,
    detect_transaction_trends,
    emit_function_regression_issue,
    limit_regressions_by_project,
    query_functions,
    query_transactions,
    query_transactions_timeseries,
    run_detection,
)
from sentry.testutils.cases import MetricsAPIBaseTestCase, ProfilesSnubaTestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import Feature, override_options
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import region_silo_test
from sentry.utils.snuba import SnubaTSResult


@pytest.fixture
def timestamp():
    return datetime(2023, 8, 1, 12, 7, 42, 521000, tzinfo=timezone.utc)


@pytest.fixture
def owner():
    return Factories.create_user()


@pytest.fixture
def organization(owner):
    return Factories.create_organization(owner=owner)


@pytest.fixture
def project(organization):
    return Factories.create_project(organization=organization)


@pytest.mark.parametrize(
    [
        "project_flags",
        "enable",
        "performance_project_option_enabled",
        "performance_project",
        "expected_performance_project",
        "profiling_project",
        "expected_profiling_project",
    ],
    [
        pytest.param(None, False, True, True, False, True, False, id="disabled"),
        pytest.param(None, True, True, False, False, False, False, id="no projects"),
        pytest.param(None, True, True, True, False, False, False, id="no transactions"),
        pytest.param(None, True, True, False, False, True, False, id="no profiles"),
        pytest.param(
            Project.flags.has_transactions,
            True,
            True,
            True,
            True,
            False,
            False,
            id="performance only",
        ),
        pytest.param(
            Project.flags.has_profiles, True, True, False, False, True, True, id="profiling only"
        ),
        pytest.param(
            Project.flags.has_transactions | Project.flags.has_profiles,
            True,
            True,
            False,
            False,
            True,
            True,
            id="performance + profiling",
        ),
        pytest.param(
            Project.flags.has_transactions,
            True,
            False,
            False,
            False,
            False,
            False,
            id="performance project option disabled",
        ),
    ],
)
@mock.patch("sentry.tasks.statistical_detectors.detect_transaction_trends")
@mock.patch("sentry.tasks.statistical_detectors.detect_function_trends")
@django_db_all
def test_run_detection_options(
    detect_function_trends,
    detect_transaction_trends,
    project_flags,
    enable,
    performance_project,
    profiling_project,
    performance_project_option_enabled,
    expected_performance_project,
    expected_profiling_project,
    project,
    timestamp,
):
    if project_flags is not None:
        project.update(flags=F("flags").bitor(project_flags))

    options = {
        "statistical_detectors.enable": enable,
    }

    features = {
        "organizations:performance-statistical-detectors-ema": [project.organization.slug]
        if performance_project
        else [],
        "organizations:profiling-statistical-detectors-ema": [project.organization.slug]
        if profiling_project
        else [],
    }

    if performance_project_option_enabled:
        ProjectOption.objects.set_value(
            project=project,
            key="sentry:performance_issue_settings",
            value={
                "transaction_duration_regression_detection_enabled": performance_project_option_enabled
            },
        )

    with freeze_time(timestamp), override_options(options), Feature(features):
        run_detection()

    if expected_performance_project:
        assert detect_transaction_trends.delay.called
        detect_transaction_trends.delay.assert_has_calls(
            [mock.call([project.organization_id], [project.id], timestamp)]
        )
    else:
        assert not detect_transaction_trends.delay.called

    if expected_profiling_project:
        assert detect_function_trends.delay.called
        detect_function_trends.delay.assert_has_calls([mock.call([project.id], timestamp)])
    else:
        assert not detect_function_trends.delay.called


@mock.patch("sentry.tasks.statistical_detectors.detect_transaction_trends")
@mock.patch("sentry.tasks.statistical_detectors.detect_function_trends")
@mock.patch("sentry.tasks.statistical_detectors.PROJECTS_PER_BATCH", 5)
@django_db_all
def test_run_detection_options_multiple_batches(
    detect_function_trends,
    detect_transaction_trends,
    organization,
    timestamp,
):
    projects = []

    flags = Project.flags.has_transactions | Project.flags.has_profiles
    for _ in range(9):
        project = Factories.create_project(organization=organization)
        project.update(flags=F("flags").bitor(flags))
        projects.append(project)

    options = {
        "statistical_detectors.enable": True,
    }

    features = {
        "organizations:performance-statistical-detectors-ema": [organization.slug],
        "organizations:profiling-statistical-detectors-ema": [organization.slug],
    }

    with freeze_time(timestamp), override_options(options), Feature(features):
        run_detection()

    # total of 9 projects, broken into batches of 5 means batch sizes of 5 + 4

    assert detect_transaction_trends.delay.called
    detect_transaction_trends.delay.assert_has_calls(
        [
            mock.call(
                [organization.id],
                [project.id for project in projects[:5]],
                timestamp,
            ),
            mock.call(
                [organization.id],
                [project.id for project in projects[5:]],
                timestamp,
            ),
        ]
    )
    assert detect_function_trends.delay.called
    detect_function_trends.delay.assert_has_calls(
        [
            mock.call([project.id for project in projects[:5]], timestamp),
            mock.call([project.id for project in projects[5:]], timestamp),
        ]
    )


@pytest.mark.parametrize(
    ["enabled"],
    [
        pytest.param(False, id="disabled"),
        pytest.param(True, id="enabled"),
    ],
)
@mock.patch("sentry.tasks.statistical_detectors.query_transactions")
@django_db_all
def test_detect_transaction_trends_options(
    query_transactions,
    enabled,
    timestamp,
    project,
):
    with override_options({"statistical_detectors.enable": enabled}):
        detect_transaction_trends([project.organization_id], [project.id], timestamp)
    assert query_transactions.called == enabled


@pytest.mark.parametrize(
    ["enabled"],
    [
        pytest.param(False, id="disabled"),
        pytest.param(True, id="enabled"),
    ],
)
@mock.patch("sentry.tasks.statistical_detectors.query_functions")
@django_db_all
def test_detect_function_trends_options(
    query_functions,
    enabled,
    timestamp,
    project,
):
    with override_options({"statistical_detectors.enable": enabled}):
        detect_function_trends([project.id], timestamp)
    assert query_functions.called == enabled


@mock.patch("sentry.snuba.functions.query")
@django_db_all
def test_detect_function_trends_query_timerange(functions_query, timestamp, project):
    with override_options({"statistical_detectors.enable": True}):
        detect_function_trends([project.id], timestamp)

    assert functions_query.called
    params = functions_query.mock_calls[0].kwargs["params"]
    assert params["start"] == datetime(2023, 8, 1, 11, 0, tzinfo=timezone.utc)
    assert params["end"] == datetime(2023, 8, 1, 11, 1, tzinfo=timezone.utc)


@mock.patch("sentry.tasks.statistical_detectors.query_transactions")
@mock.patch("sentry.tasks.statistical_detectors.detect_transaction_change_points")
@django_db_all
def test_detect_transaction_trends(
    detect_transaction_change_points,
    query_transactions,
    timestamp,
    project,
):
    n = 20
    timestamps = [timestamp - timedelta(hours=n - i) for i in range(n)]

    query_transactions.side_effect = [
        [
            DetectorPayload(
                project_id=project.id,
                group="/123",
                count=100,
                value=100 if i < n / 2 else 300,
                timestamp=ts,
            ),
        ]
        for i, ts in enumerate(timestamps)
    ]

    with override_options({"statistical_detectors.enable": True}):
        for ts in timestamps:
            detect_transaction_trends([project.organization.id], [project.id], ts)
    assert detect_transaction_change_points.apply_async.called


@pytest.mark.parametrize(
    ["ratelimit", "expected_calls"],
    [(-1, 3), (0, 0), (1, 1), (2, 2), (3, 3)],
)
@mock.patch("sentry.tasks.statistical_detectors.query_transactions")
@mock.patch("sentry.tasks.statistical_detectors.detect_transaction_change_points")
@django_db_all
def test_detect_transaction_trends_ratelimit(
    detect_transaction_change_points,
    query_transactions,
    ratelimit,
    expected_calls,
    timestamp,
    organization,
    project,
):
    n = 20
    timestamps = [timestamp - timedelta(hours=n - i) for i in range(n)]

    query_transactions.side_effect = [
        [
            DetectorPayload(
                project_id=project.id,
                group="/1",
                count=100,
                value=100 if i < n / 2 else 301,
                timestamp=ts,
            ),
            DetectorPayload(
                project_id=project.id,
                group="/2",
                count=100,
                value=100 if i < n / 2 else 302,
                timestamp=ts,
            ),
            DetectorPayload(
                project_id=project.id,
                group="/3",
                count=100,
                value=100 if i < n / 2 else 303,
                timestamp=ts,
            ),
        ]
        for i, ts in enumerate(timestamps)
    ]

    with override_options(
        {
            "statistical_detectors.enable": True,
            "statistical_detectors.ratelimit.ema": ratelimit,
        }
    ):
        for ts in timestamps:
            detect_transaction_trends([project.organization.id], [project.id], ts)

    if expected_calls > 0:
        detect_transaction_change_points.apply_async.assert_has_calls(
            [
                mock.call(
                    args=[
                        [(project.id, "/1"), (project.id, "/2"), (project.id, "/3")][
                            -expected_calls:
                        ],
                        timestamp + timedelta(hours=5),
                    ],
                    countdown=12 * 60 * 60,
                ),
            ],
        )
        assert detect_transaction_change_points.apply_async.call_count == 1
    else:
        assert detect_transaction_change_points.apply_async.call_count == 0


@pytest.mark.parametrize(
    ["ratelimit", "expected_idx"],
    [
        pytest.param(-1, 4, id="all"),
        pytest.param(0, 0, id="zero per project"),
        pytest.param(1, 2, id="one per project"),
        pytest.param(2, 3, id="two per project"),
        pytest.param(3, 4, id="three per project"),
    ],
)
def test_limit_regressions_by_project(ratelimit, timestamp, expected_idx):
    payloads = {
        (project_id, group): DetectorPayload(
            project_id=project_id,
            group=f"{project_id}_{group}",
            count=int(f"{project_id}_{group}"),
            value=int(f"{project_id}_{group}"),
            timestamp=timestamp,
        )
        for project_id in range(1, 4)
        for group in range(1, project_id + 1)
    }

    def trends():
        yield (None, 0, payloads[(1, 1)])
        yield (TrendType.Improved, 0, payloads[(2, 1)])
        yield (TrendType.Regressed, 0, payloads[(2, 2)])
        yield (TrendType.Regressed, 0, payloads[(3, 1)])
        yield (TrendType.Regressed, 1, payloads[(3, 2)])
        yield (TrendType.Regressed, 2, payloads[(3, 3)])

    expected_regressions = [
        payloads[(2, 2)],
        payloads[(3, 3)],
        payloads[(3, 2)],
        payloads[(3, 1)],
    ][:expected_idx]
    regressions = limit_regressions_by_project(trends(), ratelimit)
    assert set(regressions) == set(expected_regressions)


@mock.patch("sentry.tasks.statistical_detectors.query_functions")
@mock.patch("sentry.tasks.statistical_detectors.detect_function_change_points")
@django_db_all
def test_detect_function_trends(
    detect_function_change_points,
    query_functions,
    timestamp,
    project,
):
    n = 20
    timestamps = [timestamp - timedelta(hours=n - i) for i in range(n)]

    query_functions.side_effect = [
        [
            DetectorPayload(
                project_id=project.id,
                group=123,
                count=100,
                value=100 if i < n / 2 else 300,
                timestamp=ts,
            ),
        ]
        for i, ts in enumerate(timestamps)
    ]

    with override_options({"statistical_detectors.enable": True}):
        for ts in timestamps:
            detect_function_trends([project.id], ts)
    assert detect_function_change_points.apply_async.called


@pytest.mark.parametrize(
    ["ratelimit", "expected_calls"],
    [(-1, 3), (0, 0), (1, 1), (2, 2), (3, 3)],
)
@mock.patch("sentry.tasks.statistical_detectors.query_functions")
@mock.patch("sentry.tasks.statistical_detectors.detect_function_change_points")
@django_db_all
def test_detect_function_trends_ratelimit(
    detect_function_change_points,
    query_functions,
    ratelimit,
    expected_calls,
    timestamp,
    project,
):
    n = 20
    timestamps = [timestamp - timedelta(hours=n - i) for i in range(n)]

    query_functions.side_effect = [
        [
            DetectorPayload(
                project_id=project.id,
                group=1,
                count=100,
                value=100 if i < n / 2 else 301,
                timestamp=ts,
            ),
            DetectorPayload(
                project_id=project.id,
                group=2,
                count=100,
                value=100 if i < n / 2 else 302,
                timestamp=ts,
            ),
            DetectorPayload(
                project_id=project.id,
                group=3,
                count=100,
                value=100 if i < n / 2 else 303,
                timestamp=ts,
            ),
        ]
        for i, ts in enumerate(timestamps)
    ]

    with override_options(
        {
            "statistical_detectors.enable": True,
            "statistical_detectors.ratelimit.ema": ratelimit,
        }
    ):
        for ts in timestamps:
            detect_function_trends([project.id], ts)

    if expected_calls > 0:
        detect_function_change_points.apply_async.assert_has_calls(
            [
                mock.call(
                    args=[
                        [(project.id, 1), (project.id, 2), (project.id, 3)][-expected_calls:],
                        timestamp + timedelta(hours=5),
                    ],
                    countdown=12 * 60 * 60,
                ),
            ],
        )
        assert detect_function_change_points.apply_async.call_count == 1
    else:
        assert detect_function_change_points.apply_async.call_count == 0


@mock.patch("sentry.tasks.statistical_detectors.emit_function_regression_issue")
@mock.patch("sentry.tasks.statistical_detectors.detect_breakpoints")
@mock.patch("sentry.tasks.statistical_detectors.raw_snql_query")
@django_db_all
def test_detect_function_change_points(
    mock_raw_snql_query,
    mock_detect_breakpoints,
    mock_emit_function_regression_issue,
    timestamp,
    project,
):
    start_of_hour = timestamp.replace(minute=0, second=0, microsecond=0, tzinfo=timezone.utc)

    fingerprint = 12345

    mock_raw_snql_query.return_value = {
        "data": [
            {
                "time": (start_of_hour - timedelta(days=day, hours=hour)).isoformat(),
                "project.id": project.id,
                "fingerprint": fingerprint,
                "p95": 2 if day < 1 and hour < 8 else 1,
            }
            for day in reversed(range(14))
            for hour in reversed(range(24))
        ],
        "meta": [
            {"name": "time", "type": "DateTime"},
            {"name": "project.id", "type": "UInt64"},
            {"name": "fingerprint", "type": "UInt32"},
            {"name": "p95", "type": "Float64"},
        ],
    }

    mock_detect_breakpoints.return_value = {
        "data": [
            {
                "absolute_percentage_change": 5.0,
                "aggregate_range_1": 100000000.0,
                "aggregate_range_2": 500000000.0,
                "breakpoint": 1687323600,
                "change": "regression",
                "project": str(project.id),
                "transaction": str(fingerprint),
                "trend_difference": 400000000.0,
                "trend_percentage": 5.0,
                "unweighted_p_value": 0.0,
                "unweighted_t_value": -float("inf"),
            },
        ]
    }

    options = {
        "statistical_detectors.enable": True,
    }

    features = {
        "organizations:profiling-statistical-detectors-breakpoint": [project.organization.slug]
    }

    with override_options(options), Feature(features):
        detect_function_change_points([(project.id, fingerprint)], timestamp)
    assert mock_emit_function_regression_issue.called


@region_silo_test(stable=True)
class FunctionsTasksTest(ProfilesSnubaTestCase):
    def setUp(self):
        super().setUp()

        self.now = before_now(minutes=10)
        self.hour_ago = (self.now - timedelta(hours=1)).replace(
            minute=0, second=0, microsecond=0, tzinfo=timezone.utc
        )
        self.projects = [
            self.create_project(organization=self.organization, teams=[self.team], name="Foo"),
            self.create_project(organization=self.organization, teams=[self.team], name="Bar"),
        ]

        for project in self.projects:
            self.store_functions(
                [
                    {
                        "self_times_ns": [100 for _ in range(100)],
                        "package": "foo",
                        "function": "foo",
                        # only in app functions should
                        # appear in the results
                        "in_app": True,
                    },
                    {
                        # this function has a lower count, so `foo` is prioritized
                        "self_times_ns": [100 for _ in range(10)],
                        "package": "bar",
                        "function": "bar",
                        # only in app functions should
                        # appear in the results
                        "in_app": True,
                    },
                    {
                        "self_times_ns": [200 for _ in range(100)],
                        "package": "baz",
                        "function": "quz",
                        # non in app functions should not
                        # appear in the results
                        "in_app": False,
                    },
                ],
                project=project,
                timestamp=self.hour_ago,
            )

    @mock.patch("sentry.tasks.statistical_detectors.FUNCTIONS_PER_PROJECT", 1)
    def test_functions_query(self):
        results = query_functions(self.projects, self.now)
        assert results == [
            DetectorPayload(
                project_id=project.id,
                group=self.function_fingerprint({"package": "foo", "function": "foo"}),
                count=100,
                value=pytest.approx(100),  # type: ignore[arg-type]
                timestamp=self.hour_ago,
            )
            for project in self.projects
        ]

    @mock.patch("sentry.tasks.statistical_detectors.get_from_profiling_service")
    def test_emit_function_regression_issue(self, mock_get_from_profiling_service):
        mock_value = mock.MagicMock()
        mock_value.status = 200
        mock_value.data = b'{"occurrences":5}'
        mock_get_from_profiling_service.return_value = mock_value

        breakpoints: List[BreakpointData] = [
            {
                "project": str(project.id),
                "transaction": str(
                    self.function_fingerprint({"package": "foo", "function": "foo"})
                ),
                "aggregate_range_1": 100_000_000,
                "aggregate_range_2": 200_000_000,
                "unweighted_t_value": 1.23,
                "unweighted_p_value": 1.23,
                "trend_percentage": 1.23,
                "absolute_percentage_change": 1.23,
                "trend_difference": 1.23,
                "breakpoint": (self.hour_ago - timedelta(hours=12)).timestamp(),
            }
            for project in self.projects
        ]
        emitted = emit_function_regression_issue(
            {project.id: project for project in self.projects}, breakpoints, self.now
        )
        assert emitted == 5


@region_silo_test(stable=True)
@pytest.mark.sentry_metrics
class TestTransactionsQuery(MetricsAPIBaseTestCase):
    def setUp(self):
        super().setUp()
        self.num_projects = 2
        self.num_transactions = 4

        self.hour_ago = (self.now - timedelta(hours=1)).replace(
            minute=0, second=0, microsecond=0, tzinfo=timezone.utc
        )
        self.hour_ago_seconds = int(self.hour_ago.timestamp())
        self.org = self.create_organization(owner=self.user)
        self.projects = [
            self.create_project(organization=self.org) for _ in range(self.num_projects)
        ]

        for project in self.projects:
            for i in range(self.num_transactions):
                # Store metrics for a backend transaction
                self.store_metric(
                    self.org.id,
                    project.id,
                    "distribution",
                    TransactionMRI.DURATION.value,
                    {"transaction": f"transaction_{i}", "transaction.op": "http.server"},
                    self.hour_ago_seconds,
                    1.0,
                    UseCaseID.TRANSACTIONS,
                )
                self.store_metric(
                    self.org.id,
                    project.id,
                    "distribution",
                    TransactionMRI.DURATION.value,
                    {"transaction": f"transaction_{i}", "transaction.op": "http.server"},
                    self.hour_ago_seconds,
                    9.5,
                    UseCaseID.TRANSACTIONS,
                )

                # Store metrics for a frontend transaction, which should be
                # ignored by the query
                self.store_metric(
                    self.org.id,
                    project.id,
                    "distribution",
                    TransactionMRI.DURATION.value,
                    {"transaction": f"fe_transaction_{i}", "transaction.op": "navigation"},
                    self.hour_ago_seconds,
                    1.0,
                    UseCaseID.TRANSACTIONS,
                )
                self.store_metric(
                    self.org.id,
                    project.id,
                    "distribution",
                    TransactionMRI.DURATION.value,
                    {"transaction": f"fe_transaction_{i}", "transaction.op": "navigation"},
                    self.hour_ago_seconds,
                    9.5,
                    UseCaseID.TRANSACTIONS,
                )

    @property
    def now(self):
        return MetricsAPIBaseTestCase.MOCK_DATETIME

    def test_transactions_query(self) -> None:
        res = query_transactions(
            [self.org.id],
            [p.id for p in self.projects],
            self.hour_ago,
            self.now,
            self.num_transactions + 1,  # detect if any extra transactions are returned
        )

        assert len(res) == len(self.projects) * self.num_transactions
        for trend_payload in res:
            assert trend_payload.count == 2
            # p95 is  calculated by a probabilistic data structure, as such the value won't actually be 9.5 since we only have
            # one sample at 9.5, but it should be close
            assert trend_payload.value > 9
            assert trend_payload.timestamp == self.hour_ago


@region_silo_test(stable=True)
@pytest.mark.sentry_metrics
class TestTransactionChangePointDetection(MetricsAPIBaseTestCase):
    def setUp(self):
        super().setUp()
        self.num_projects = 2
        self.num_transactions = 4

        self.hour_ago = (self.now - timedelta(hours=1)).replace(
            minute=0, second=0, microsecond=0, tzinfo=timezone.utc
        )
        self.hour_ago_seconds = int(self.hour_ago.timestamp())
        self.org = self.create_organization(owner=self.user)
        self.projects = [
            self.create_project(organization=self.org) for _ in range(self.num_projects)
        ]

        def store_metric(project_id, transaction, minutes_ago, value):
            self.store_metric(
                self.org.id,
                project_id,
                "distribution",
                TransactionMRI.DURATION_LIGHT.value,
                {"transaction": transaction},
                int((self.now - timedelta(minutes=minutes_ago)).timestamp()),
                value,
                UseCaseID.TRANSACTIONS,
            )

        for project in self.projects:
            for i in range(self.num_transactions):
                store_metric(project.id, f"transaction_{i}", 20, 9.5)
                store_metric(project.id, f"transaction_{i}", 40, 9.5)
                store_metric(project.id, f"transaction_{i}", 60, 9.5)
                store_metric(project.id, f"transaction_{i}", 80, 1.0)
                store_metric(project.id, f"transaction_{i}", 100, 1.0)
                store_metric(project.id, f"transaction_{i}", 120, 1.0)

    @property
    def now(self):
        return MetricsAPIBaseTestCase.MOCK_DATETIME

    def test_query_transactions_timeseries(self) -> None:
        results = [
            timeseries
            for timeseries in query_transactions_timeseries(
                [
                    (self.projects[0], "transaction_1"),
                    (self.projects[0], "transaction_2"),
                    (self.projects[1], "transaction_1"),
                ],
                self.now,
                "p95(transaction.duration)",
            )
        ]

        end = self.now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        start = end - timedelta(days=14)
        first_timeseries_time = self.now - timedelta(hours=2)
        second_timeseries_time = self.now - timedelta(hours=1)
        assert results == [
            (
                self.projects[0].id,
                "transaction_1",
                SnubaTSResult(
                    {
                        "data": zerofill(
                            [
                                {
                                    "transaction": "transaction_1",
                                    "time": first_timeseries_time.isoformat(),
                                    "project_id": self.projects[0].id,
                                    "p95_transaction_duration": 1.0,
                                },
                                {
                                    "transaction": "transaction_1",
                                    "time": second_timeseries_time.isoformat(),
                                    "project_id": self.projects[0].id,
                                    "p95_transaction_duration": 9.5,
                                },
                            ],
                            start,
                            end,
                            3600,
                            "time",
                        ),
                        "project": self.projects[0].id,
                    },
                    start,
                    end,
                    3600,
                ),
            ),
            (
                self.projects[0].id,
                "transaction_2",
                SnubaTSResult(
                    {
                        "data": zerofill(
                            [
                                {
                                    "transaction": "transaction_2",
                                    "time": first_timeseries_time.isoformat(),
                                    "project_id": self.projects[0].id,
                                    "p95_transaction_duration": 1.0,
                                },
                                {
                                    "transaction": "transaction_2",
                                    "time": second_timeseries_time.isoformat(),
                                    "project_id": self.projects[0].id,
                                    "p95_transaction_duration": 9.5,
                                },
                            ],
                            start,
                            end,
                            3600,
                            "time",
                        ),
                        "project": self.projects[0].id,
                    },
                    start,
                    end,
                    3600,
                ),
            ),
            (
                self.projects[1].id,
                "transaction_1",
                SnubaTSResult(
                    {
                        "data": zerofill(
                            [
                                {
                                    "transaction": "transaction_1",
                                    "time": first_timeseries_time.isoformat(),
                                    "project_id": self.projects[1].id,
                                    "p95_transaction_duration": 1.0,
                                },
                                {
                                    "transaction": "transaction_1",
                                    "time": second_timeseries_time.isoformat(),
                                    "project_id": self.projects[1].id,
                                    "p95_transaction_duration": 9.5,
                                },
                            ],
                            start,
                            end,
                            3600,
                            "time",
                        ),
                        "project": self.projects[1].id,
                    },
                    start,
                    end,
                    3600,
                ),
            ),
        ]

    def test_query_transactions_single_timeseries(self) -> None:
        results = [
            timeseries
            for timeseries in query_transactions_timeseries(
                [(self.projects[0], "transaction_1")],
                self.now,
                "p95(transaction.duration)",
            )
        ]
        assert len(results) == 1

    @mock.patch("sentry.tasks.statistical_detectors.send_regression_to_platform")
    @mock.patch("sentry.tasks.statistical_detectors.detect_breakpoints")
    def test_transaction_change_point_detection(
        self, mock_detect_breakpoints, mock_send_regression_to_platform
    ) -> None:
        mock_detect_breakpoints.return_value = {
            "data": [
                {
                    "absolute_percentage_change": 5.0,
                    "aggregate_range_1": 100000000.0,
                    "aggregate_range_2": 500000000.0,
                    "breakpoint": 1687323600,
                    "change": "regression",
                    "project": str(self.projects[0].id),
                    "transaction": "transaction_1",
                    "trend_difference": 400000000.0,
                    "trend_percentage": 5.0,
                    "unweighted_p_value": 0.0,
                    "unweighted_t_value": -float("inf"),
                },
            ]
        }

        options = {"statistical_detectors.enable": True}
        features = {
            "organizations:performance-statistical-detectors-breakpoint": [self.org.slug],
        }

        with override_options(options), Feature(features):
            detect_transaction_change_points(
                [
                    (self.projects[0].id, "transaction_1"),
                    (self.projects[0].id, "transaction_2"),
                    (self.projects[1].id, "transaction_1"),
                ],
                self.now,
            )
        assert mock_send_regression_to_platform.called
