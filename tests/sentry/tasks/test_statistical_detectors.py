from datetime import datetime, timedelta, timezone
from unittest import mock

import pytest
from django.db.models import F
from freezegun import freeze_time

from sentry.models import Project
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.statistical_detectors.detector import DetectorPayload
from sentry.tasks.statistical_detectors import (
    detect_function_trends,
    detect_transaction_trends,
    query_functions,
    query_transactions,
    run_detection,
)
from sentry.testutils.cases import MetricsAPIBaseTestCase, ProfilesSnubaTestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import before_now
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
            [mock.call([project.organization_id], [project.id], timestamp, 50)]
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
            mock.call([project.id for project in projects[:5]], timestamp),
            mock.call([project.id for project in projects[5:]], timestamp),
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
        detect_transaction_trends([project.id], timestamp)
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


@mock.patch("sentry.tasks.statistical_detectors.query_functions")
@django_db_all
def test_detect_function_trends(
    query_functions,
    timestamp,
    project,
):
    timestamps = [timestamp - timedelta(hours=i) for i in range(3, 0, -1)]

    query_functions.side_effect = [
        [
            DetectorPayload(
                project_id=project.id,
                group=123,
                count=100,
                value=100,
                timestamp=ts,
            ),
        ]
        for ts in timestamps
    ]

    with override_options({"statistical_detectors.enable": True}):
        for ts in timestamps:
            detect_function_trends([project.id], ts)


@region_silo_test(stable=True)
class FunctionsQueryTest(ProfilesSnubaTestCase):
    def setUp(self):
        super().setUp()

        self.now = before_now(minutes=10)
        self.hour_ago = (self.now - timedelta(hours=1)).replace(
            minute=0, second=0, microsecond=0, tzinfo=timezone.utc
        )

    def test_functions_query(self):
        self.store_functions(
            [
                {
                    "self_times_ns": [100 for _ in range(100)],
                    "package": "foo",
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
            project=self.project,
            timestamp=self.hour_ago,
        )

        results = query_functions([self.project], self.now)
        assert results == [
            DetectorPayload(
                project_id=self.project.id,
                group=self.function_fingerprint({"package": "foo", "function": "bar"}),
                count=100,
                value=pytest.approx(100),  # type: ignore[arg-type]
                timestamp=self.hour_ago,
            )
        ]


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
        for project in self.projects:
            for i in range(self.num_transactions):
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
