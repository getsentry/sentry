from dataclasses import replace
from datetime import UTC, datetime
from unittest import mock

import orjson
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.workflow_engine.processors.evaluations.base import EvaluationPhase, EvaluationType
from sentry.workflow_engine.processors.evaluations.condition import DataConditionEvaluationArtifact
from sentry.workflow_engine.processors.evaluations.condition_group import (
    DataConditionGroupEvaluationArtifact,
)
from sentry.workflow_engine.processors.evaluations.detector import (
    DetectorEvaluationArtifact,
    DetectorEvaluationOutcome,
)
from sentry.workflow_engine.processors.evaluations.eap import (
    EVALUATION_RETENTION_DAYS,
    EvaluationArtifactContext,
    EvaluationArtifactItem,
    build_evaluation_trace_item,
    produce_evaluation_artifacts_to_eap,
)
from sentry.workflow_engine.types import DetectorPriorityLevel


def _artifact_item() -> EvaluationArtifactItem:
    condition = DataConditionEvaluationArtifact(
        triggered=False,
        error=None,
        comparison="100",
        condition_id=4,
        condition_type="greater",
        input_type="float",
        input=42.5,
        result=None,
    )
    artifact = DetectorEvaluationArtifact(
        event_id="a" * 32,
        group_key="region-us",
        priority=DetectorPriorityLevel.HIGH.value,
        trigger_evaluation=DataConditionGroupEvaluationArtifact(
            triggered=False,
            error=None,
            logic_type="any",
            result=False,
            condition_evaluations=[condition],
        ),
        triggered=False,
        error=None,
    )
    return EvaluationArtifactItem(
        context=EvaluationArtifactContext(
            organization_id=1,
            project_id=2,
            evaluation_type=EvaluationType.DETECTOR,
            evaluation_phase=EvaluationPhase.INITIAL,
            outcome=DetectorEvaluationOutcome.NOT_TRIGGERED,
            detector_id=3,
            detector_type="metric_issue",
            error=None,
            event_id=artifact.event_id,
            group_key=artifact.group_key,
        ),
        artifact=artifact,
    )


def test_build_evaluation_trace_item() -> None:
    artifact_item = _artifact_item()
    emitted_at = datetime(2024, 1, 2, 3, 4, 5, tzinfo=UTC)

    trace_item = build_evaluation_trace_item(
        artifact_item,
        emitted_at=emitted_at,
    )

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

    serialized_artifact = orjson.loads(trace_item.attributes["evaluation_artifact"].string_value)
    assert serialized_artifact["organization_id"] == 1
    assert serialized_artifact["trigger_evaluation"]["condition_evaluations"] == [
        {
            "comparison": "100",
            "condition_id": 4,
            "condition_type": "greater",
            "error": None,
            "input": 42.5,
            "input_type": "float",
            "result": None,
            "triggered": False,
        }
    ]


def test_build_evaluation_trace_item_requires_project_scope() -> None:
    artifact_item = _artifact_item()
    artifact_item = replace(
        artifact_item,
        context=replace(artifact_item.context, project_id=None),
    )

    assert (
        build_evaluation_trace_item(
            artifact_item,
            emitted_at=datetime(2024, 1, 2, 3, 4, 5, tzinfo=UTC),
        )
        is None
    )


def test_build_evaluation_trace_item_has_stable_id() -> None:
    emitted_at = datetime(2024, 1, 2, 3, 4, 5, tzinfo=UTC)

    first = build_evaluation_trace_item(_artifact_item(), emitted_at=emitted_at)
    second = build_evaluation_trace_item(_artifact_item(), emitted_at=emitted_at)

    assert first is not None
    assert second is not None
    assert first.item_id == second.item_id


@mock.patch("sentry.workflow_engine.processors.evaluations.eap.metrics.incr")
@mock.patch("sentry.workflow_engine.processors.evaluations.eap._eap_producer")
@mock.patch("sentry.workflow_engine.processors.evaluations.eap.get_topic_definition")
def test_producer_failure_does_not_propagate(
    mock_get_topic_definition: mock.MagicMock,
    mock_producer: mock.MagicMock,
    mock_metrics_incr: mock.MagicMock,
) -> None:
    mock_get_topic_definition.return_value = {"real_topic_name": "test-eap-items"}
    mock_producer.produce.side_effect = RuntimeError("producer unavailable")

    produce_evaluation_artifacts_to_eap(
        [_artifact_item()],
        emitted_at=datetime(2024, 1, 2, 3, 4, 5, tzinfo=UTC),
    )

    mock_metrics_incr.assert_called_once_with(
        "workflow_engine.evaluation_eap.produce_failed",
        sample_rate=1.0,
    )
