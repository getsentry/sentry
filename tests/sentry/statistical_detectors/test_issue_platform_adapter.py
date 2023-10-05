from typing import List
from unittest import mock

from sentry.issues.grouptype import PerformanceDurationRegressionGroupType
from sentry.seer.utils import BreakpointData
from sentry.statistical_detectors.issue_platform_adapter import send_regressions_to_plaform


@mock.patch("sentry.statistical_detectors.issue_platform_adapter.produce_occurrence_to_kafka")
def test_send_regressions_to_plaform(mock_produce_occurrence_to_kafka):
    project_id = "123"

    mock_regressions: List[BreakpointData] = [
        {
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
    ]

    send_regressions_to_plaform(mock_regressions)

    assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1

    occurrence, event = mock_produce_occurrence_to_kafka.mock_calls[0].args
    occurrence = occurrence.to_dict()

    assert dict(
        occurrence,
        **{
            "project_id": 123,
            "issue_title": "Exp Transaction Duration Regression",
            "subtitle": "Increased from 14.0ms to 28.0ms (P95)",
            "resource_id": None,
            "evidence_data": mock_regressions[0],
            "evidence_display": [
                {
                    "name": "Regression",
                    "value": "Increased from 14.0ms to 28.0ms (P95)",
                    "important": True,
                },
                {"name": "Transaction", "value": "foo", "important": True},
            ],
            "type": PerformanceDurationRegressionGroupType.type_id,
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
