from datetime import datetime, timedelta, timezone
from typing import List
from unittest import mock

import pytest
from django.db.models import F

from sentry.models import Project
from sentry.seer.utils import BreakpointData
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.statistical_detectors.detector import DetectorPayload
from sentry.tasks.statistical_detectors import (
    detect_function_change_points,
    detect_function_trends,
    detect_transaction_change_points,
    detect_transaction_trends,
    emit_function_regression_issue,
    query_functions,
    query_transactions,
    run_detection,
)
from sentry.testutils.cases import MetricsAPIBaseTestCase, ProfilesSnubaTestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import region_silo_test


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
        "performance_project",
        "expected_performance_project",
        "profiling_project",
        "expected_profiling_project",
    ],
    [
        pytest.param(None, False, True, False, True, False, id="disabled"),
        pytest.param(None, True, False, False, False, False, id="no projects"),
        pytest.param(None, True, True, False, False, False, id="no transactions"),
        pytest.param(None, True, False, False, True, False, id="no profiles"),
        pytest.param(
            Project.flags.has_transactions, True, True, True, False, False, id="performance only"
        ),
        pytest.param(
            Project.flags.has_profiles, True, False, False, True, True, id="profiling only"
        ),
        pytest.param(
            Project.flags.has_transactions | Project.flags.has_profiles,
            True,
            False,
            False,
            True,
            True,
            id="performance + profiling",
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
    expected_performance_project,
    expected_profiling_project,
    project,
    timestamp,
):
    if project_flags is not None:
        project.update(flags=F("flags").bitor(project_flags))

    options = {
        "statistical_detectors.enable": enable,
        "statistical_detectors.enable.projects.performance": [project.id]
        if performance_project
        else [],
        "statistical_detectors.enable.projects.profiling": [project.id]
        if profiling_project
        else [],
    }

    with freeze_time(timestamp), override_options(options), TaskRunner():
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

    project_ids = [project.id for project in projects]

    options = {
        "statistical_detectors.enable": True,
        "statistical_detectors.enable.projects.performance": project_ids,
        "statistical_detectors.enable.projects.profiling": project_ids,
    }

    with freeze_time(timestamp), override_options(options), TaskRunner():
        run_detection()

    # total of 9 projects, broken into batches of 5 means batch sizes of 5 + 4

    assert detect_transaction_trends.delay.called
    detect_transaction_trends.delay.assert_has_calls(
        [
            mock.call(
                [project.organization_id for project in projects[:5]],
                [project.id for project in projects[:5]],
                timestamp,
            ),
            mock.call(
                [project.organization_id for project in projects[5:]],
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
    organization,
):
    n = 20
    timestamps = [timestamp - timedelta(hours=n - i) for i in range(n)]

    query_transactions.side_effect = [
        [
            DetectorPayload(
                project_id=project.id,
                group="/123",
                count=100,
                value=100 if i < n / 2 else 200,
                timestamp=ts,
            ),
        ]
        for i, ts in enumerate(timestamps)
    ]

    with override_options({"statistical_detectors.enable": True}), TaskRunner():
        for ts in timestamps:
            detect_transaction_trends([organization.id], [project.id], ts)
    assert detect_transaction_change_points.apply_async.called


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
                value=100 if i < n / 2 else 200,
                timestamp=ts,
            ),
        ]
        for i, ts in enumerate(timestamps)
    ]

    with override_options({"statistical_detectors.enable": True}), TaskRunner():
        for ts in timestamps:
            detect_function_trends([project.id], ts)
    assert detect_function_change_points.apply_async.called


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
        ]
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

    with override_options({"statistical_detectors.enable": True}):
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
        emitted = emit_function_regression_issue(breakpoints, self.now)
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
                self.store_metric(
                    self.org.id,
                    project.id,
                    "distribution",
                    TransactionMRI.DURATION.value,
                    {"transaction": f"transaction_{i}"},
                    self.hour_ago_seconds,
                    1.0,
                    UseCaseID.TRANSACTIONS,
                )
                self.store_metric(
                    self.org.id,
                    project.id,
                    "distribution",
                    TransactionMRI.DURATION.value,
                    {"transaction": f"transaction_{i}"},
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
            self.num_transactions,
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
                TransactionMRI.DURATION.value,
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

    @mock.patch("sentry.tasks.statistical_detectors.send_regressions_to_plaform")
    @mock.patch("sentry.tasks.statistical_detectors.detect_breakpoints")
    def test_transaction_change_point_detection(
        self, mock_detect_breakpoints, mock_send_regressions_to_platform
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
        with override_options({"statistical_detectors.enable": True}):
            detect_transaction_change_points(
                [
                    (self.projects[0].id, "transaction_1"),
                    (self.projects[0].id, "transaction_2"),
                    (self.projects[1].id, "transaction_1"),
                ],
                self.now,
            )
        assert mock_send_regressions_to_platform.called
