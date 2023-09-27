from unittest import mock

from sentry.issues.grouptype import PerformanceDurationRegressionGroupType
from sentry.statistical_detectors.issue_platform_adapter import send_regressions_to_plaform


@mock.patch("sentry.statistical_detectors.issue_platform_adapter.produce_occurrence_to_kafka")
def test_send_regressions_to_platform(mock_produce_occurrence_to_kafka):
    project_slug = "test"
    project_id = 123

    mock_regression = [
        {
            "project": project_slug,
            "project_id": project_id,
            "transaction": "foo",
            "change": "regression",
            "trend_percentage": 2.0,
            "aggregate_range_1": 14,
            "aggregate_range_2": 28,
        }
    ]

    send_regressions_to_plaform(mock_regression)

    assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1

    occurrence, event = mock_produce_occurrence_to_kafka.mock_calls[0].args
    occurrence = occurrence.to_dict()

    assert dict(
        occurrence,
        **{
            "project_id": project_id,
            "issue_title": "Exp Duration Regression",
            "subtitle": "Increased from 14.0ms to 28.0ms (P95)",
            "resource_id": None,
            "evidence_data": mock_regression[0],
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
            "project_id": project_id,
            "transaction": "foo",
            "event_id": occurrence["event_id"],
            "platform": "python",
            "tags": {},
        },
    ) == dict(event)
