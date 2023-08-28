from datetime import datetime, timedelta, timezone
from unittest import mock

import pytest
from freezegun import freeze_time

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
def team(organization, owner):
    team = Factories.create_team(organization=organization)
    Factories.create_team_membership(team=team, user=owner)
    return team


@pytest.fixture
def project(organization, team):
    return Factories.create_project(organization=organization, teams=[team])


@pytest.mark.parametrize(
    "options,performance_projects,profiling_projects",
    [
        pytest.param(
            {
                "statistical_detectors.enable": False,
                "statistical_detectors.enable.projects.performance": [1],
                "statistical_detectors.enable.projects.profiling": [1],
            },
            None,
            None,
            id="disabled",
        ),
        pytest.param(
            {
                "statistical_detectors.enable": True,
                "statistical_detectors.enable.projects.performance": [],
                "statistical_detectors.enable.projects.profiling": [],
            },
            None,
            None,
            id="no projects",
        ),
        pytest.param(
            {
                "statistical_detectors.enable": True,
                "statistical_detectors.enable.projects.performance": [1],
                "statistical_detectors.enable.projects.profiling": [],
            },
            [[1]],
            None,
            id="performance only",
        ),
        pytest.param(
            {
                "statistical_detectors.enable": True,
                "statistical_detectors.enable.projects.performance": [],
                "statistical_detectors.enable.projects.profiling": [1],
            },
            None,
            [[1]],
            id="profiling only",
        ),
    ],
)
@mock.patch("sentry.tasks.statistical_detectors.detect_transaction_trends")
@mock.patch("sentry.tasks.statistical_detectors.detect_function_trends")
@django_db_all
def test_run_detection_options(
    detect_function_trends,
    detect_transaction_trends,
    options,
    performance_projects,
    profiling_projects,
    timestamp,
):
    with freeze_time(timestamp), override_options(options), TaskRunner():
        run_detection()

    if performance_projects is None:
        assert not detect_transaction_trends.delay.called
    else:
        assert detect_transaction_trends.delay.called
        detect_transaction_trends.delay.assert_has_calls(
            [mock.call(projects) for projects in performance_projects]
        )

    if profiling_projects is None:
        assert not detect_function_trends.delay.called
    else:
        assert detect_function_trends.delay.called
        detect_function_trends.delay.assert_has_calls(
            [mock.call(call, timestamp) for call in profiling_projects],
        )


@pytest.mark.parametrize(
    "enabled",
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
    "enabled",
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
