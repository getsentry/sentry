from datetime import UTC, datetime
from unittest import mock

import orjson  # pyright: ignore[reportMissingImports]
from sentry_protos.snuba.v1.request_common_pb2 import (  # pyright: ignore[reportMissingImports]
    TraceItemType,
)

from sentry.workflow_engine.processors.evaluation_eap import (  # pyright: ignore[reportMissingImports]
    EVALUATION_RETENTION_DAYS,
    build_evaluation_trace_item,
    produce_evaluation_artifacts_to_eap,
)


def _artifact() -> dict[str, object]:
    return {
        "organization_id": 1,
        "project_id": 2,
        "evaluation_type": "detector",
        "outcome": "not_triggered",
        "detector_id": 3,
        "detector_type": "metric_issue",
        "event_id": "a" * 32,
        "group_key": "region-us",
        "evaluation_value": 42.5,
        "triggered": False,
        "error": None,
        "trigger_evaluation": {
            "triggered": False,
            "condition_evaluations": [],
        },
    }


def test_build_evaluation_trace_item() -> None:
    artifact = _artifact()
    emitted_at = datetime(2024, 1, 2, 3, 4, 5, tzinfo=UTC)

    trace_item = build_evaluation_trace_item(artifact, emitted_at=emitted_at)

    assert trace_item is not None
    assert trace_item.organization_id == 1
    assert trace_item.project_id == 2
    assert trace_item.item_type == TraceItemType.TRACE_ITEM_TYPE_LOG
    assert trace_item.trace_id == "a" * 32
    assert trace_item.retention_days == EVALUATION_RETENTION_DAYS
    assert trace_item.attributes["source"].string_value == "workflow_engine.evaluation"
    assert trace_item.attributes["detector_id"].int_value == 3
    assert trace_item.attributes["detector_group_key"].string_value == "region-us"
    assert trace_item.attributes["evaluation_value"].double_value == 42.5
    assert trace_item.attributes["has_error"].bool_value is False
    assert orjson.loads(trace_item.attributes["evaluation_artifact"].string_value) == artifact


def test_build_evaluation_trace_item_requires_project_scope() -> None:
    artifact = _artifact()
    artifact["project_id"] = None

    assert (
        build_evaluation_trace_item(
            artifact,
            emitted_at=datetime(2024, 1, 2, 3, 4, 5, tzinfo=UTC),
        )
        is None
    )


def test_build_evaluation_trace_item_has_stable_id() -> None:
    emitted_at = datetime(2024, 1, 2, 3, 4, 5, tzinfo=UTC)

    first = build_evaluation_trace_item(_artifact(), emitted_at=emitted_at)
    second = build_evaluation_trace_item(_artifact(), emitted_at=emitted_at)

    assert first is not None
    assert second is not None
    assert first.item_id == second.item_id


@mock.patch("sentry.workflow_engine.processors.evaluation_eap.metrics.incr")
@mock.patch("sentry.workflow_engine.processors.evaluation_eap._eap_producer")
@mock.patch("sentry.workflow_engine.processors.evaluation_eap.get_topic_definition")
def test_producer_failure_does_not_propagate(
    mock_get_topic_definition: mock.MagicMock,
    mock_producer: mock.MagicMock,
    mock_metrics_incr: mock.MagicMock,
) -> None:
    mock_get_topic_definition.return_value = {"real_topic_name": "test-eap-items"}
    mock_producer.produce.side_effect = RuntimeError("producer unavailable")

    produce_evaluation_artifacts_to_eap(
        [_artifact()],
        emitted_at=datetime(2024, 1, 2, 3, 4, 5, tzinfo=UTC),
    )

    mock_metrics_incr.assert_called_once_with(
        "workflow_engine.evaluation_eap.produce_failed",
        sample_rate=1.0,
    )
