from datetime import datetime, timedelta, timezone
from unittest import mock

import pytest
from django.db.models import F
from freezegun import freeze_time

from sentry.models import Project
from sentry.statistical_detectors.detector import TrendPayload
from sentry.tasks.statistical_detectors import (
    detect_function_trends,
    detect_transaction_trends,
    query_functions,
    run_detection,
)
from sentry.testutils.cases import ProfilesSnubaTestCase
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
        detect_transaction_trends.delay.assert_has_calls([mock.call([project.id], timestamp)])
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
        detect_transaction_trends([project.id])
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
        assert results == {
            self.project.id: [
                TrendPayload(
                    group=self.function_fingerprint({"package": "foo", "function": "bar"}),
                    count=100,
                    value=pytest.approx(100),  # type: ignore[arg-type]
                    timestamp=self.hour_ago,
                )
            ],
        }
