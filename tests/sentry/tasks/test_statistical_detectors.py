from datetime import datetime, timezone
from unittest import mock

import pytest
from freezegun import freeze_time

from sentry.tasks.statistical_detectors import detect_regressed_functions, run_detection
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.testutils.pytest.fixtures import django_db_all


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
@mock.patch("sentry.tasks.statistical_detectors.detect_regressed_transactions")
@mock.patch("sentry.tasks.statistical_detectors.detect_regressed_functions")
@django_db_all
def test_run_detection_options(
    detect_regressed_functions,
    detect_regressed_transactions,
    options,
    performance_projects,
    profiling_projects,
    timestamp,
):
    with freeze_time(timestamp), override_options(options), TaskRunner():
        run_detection()

    if performance_projects is None:
        assert not detect_regressed_transactions.delay.called
    else:
        assert detect_regressed_transactions.delay.called
        detect_regressed_transactions.delay.assert_has_calls(
            [mock.call(projects) for projects in performance_projects]
        )

    if profiling_projects is None:
        assert not detect_regressed_functions.delay.called
    else:
        assert detect_regressed_functions.delay.called
        detect_regressed_functions.delay.assert_has_calls(
            [mock.call(call, timestamp) for call in profiling_projects],
        )


@pytest.mark.parametrize(
    "enabled",
    [
        pytest.param(False, id="disabled"),
        pytest.param(True, id="enabled"),
    ],
)
@mock.patch("sentry.tasks.statistical_detectors.query_functions")
@django_db_all
def test_detect_regressed_functions_options(
    query_functions,
    enabled,
    timestamp,
    project,
):
    with override_options({"statistical_detectors.enable": enabled}):
        detect_regressed_functions([project.id], timestamp)
    assert query_functions.called == enabled


@mock.patch("sentry.snuba.functions.query")
@django_db_all
def test_detect_regressed_functions_query_timerange(functions_query, timestamp, project):
    with override_options({"statistical_detectors.enable": True}):
        detect_regressed_functions([project.id], timestamp)

    assert functions_query.called
    params = functions_query.mock_calls[0].kwargs["params"]
    assert params["start"] == datetime(2023, 8, 1, 11, 0, tzinfo=timezone.utc)
    assert params["end"] == datetime(2023, 8, 1, 11, 1, tzinfo=timezone.utc)
