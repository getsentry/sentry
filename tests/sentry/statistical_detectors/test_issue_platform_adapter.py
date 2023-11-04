from unittest import mock

import pytest

from sentry.issues.grouptype import (
    PerformanceDurationRegressionGroupType,
    PerformanceP95EndpointRegressionGroupType,
)
from sentry.seer.utils import BreakpointData
from sentry.statistical_detectors.issue_platform_adapter import send_regression_to_platform


@pytest.mark.parametrize(
    ["released", "issue_type"],
    [
        pytest.param(False, PerformanceDurationRegressionGroupType, id="unreleased"),
        pytest.param(True, PerformanceP95EndpointRegressionGroupType, id="released"),
    ],
)
@mock.patch("sentry.statistical_detectors.issue_platform_adapter.produce_occurrence_to_kafka")
def test_send_regressions_to_plaform(
    mock_produce_occurrence_to_kafka,
    released,
    issue_type,
):
    project_id = "123"

    mock_regression: BreakpointData = {
        "project": project_id,
        "transaction": "foo",
        "trend_percentage": 2.0,
        "aggregate_range_1": 14,
        "aggregate_range_2": 28,
        "unweighted_t_value": 1,
        "unweighted_p_value": 2,
        "absolute_percentage_change": 1.96,
        "trend_difference": 16.6,
        "breakpoint": 1691366400,
    }

    send_regression_to_platform(mock_regression, released)

    assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1

    kwargs = mock_produce_occurrence_to_kafka.call_args.kwargs
    occurrence = kwargs["occurrence"]
    event = kwargs["event_data"]
    occurrence = occurrence.to_dict()

    assert dict(
        occurrence,
        **{
            "project_id": 123,
            "issue_title": issue_type.description,
            "subtitle": "Increased from 14.0ms to 28.0ms (P95)",
            "resource_id": None,
            "evidence_data": mock_regression,
            "evidence_display": [
                {
                    "name": "Regression",
                    "value": "foo duration increased from 14.0ms to 28.0ms (P95)",
                    "important": True,
                },
                {"name": "Transaction", "value": "foo", "important": True},
            ],
            "type": issue_type.type_id,
            "level": "info",
            "culprit": "foo",
        },
    ) == dict(occurrence)

    assert dict(
        event,
        **{
            "project_id": 123,
            "transaction": "foo",
            "event_id": occurrence["event_id"],
            "platform": "python",
            "tags": {},
        },
    ) == dict(event)
