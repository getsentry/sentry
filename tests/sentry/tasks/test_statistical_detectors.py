from datetime import datetime, timezone
from unittest import mock

import pytest
from freezegun import freeze_time

from sentry.tasks.statistical_detectors import run_detection
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.testutils.pytest.fixtures import django_db_all


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
def test_statistical_detectors_options(
    detect_regressed_functions,
    detect_regressed_transactions,
    options,
    performance_projects,
    profiling_projects,
):
    timestamp = datetime(2023, 8, 1, 12, 7, 42, 521000, tzinfo=timezone.utc)

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
