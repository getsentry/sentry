from dataclasses import asdict
from typing import Any
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.backends.local.backend import LocalBroker
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.types import Partition
from arroyo.types import Topic as ArroyoTopic
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.conf.types.kafka_definition import Topic
from sentry.models.group import GroupStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import Feature
from sentry.testutils.helpers.options import override_options
from sentry.utils.kafka_config import get_topic_definition
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.processors.evaluations import (
    DataConditionEvaluation,
    DataConditionGroupEvaluation,
    DeferredWorkflowEvaluationResult,
    EvaluationPhase,
    EvaluationType,
    ProcessDetectorsResult,
    ProcessWorkflowsResult,
    WorkflowEvaluation,
    WorkflowEvaluationArtifact,
    WorkflowEvaluationBatch,
    WorkflowEvaluationOutcome,
)
from sentry.workflow_engine.processors.evaluations.eap import (
    EAP_ITEMS_CODEC,
    emit_evaluation_to_eap,
)
from sentry.workflow_engine.processors.evaluations.logging import (
    redact_pii_from_artifact,
    should_log,
)
from sentry.workflow_engine.processors.evaluations.tracking import emit_evaluations
from sentry.workflow_engine.types import ConditionError, WorkflowEventData

LOGGING_MODULE = "sentry.workflow_engine.processors.evaluations.logging"


class EmptyDelayedWorkflowEvaluationBatch(WorkflowEvaluationBatch):
    @property
    def evaluation_phase(self) -> EvaluationPhase:
        return EvaluationPhase.DELAYED

    def evaluated_workflow_ids(self) -> set[int]:
        return set()

    def evaluation_artifacts(self) -> tuple[WorkflowEvaluationArtifact, ...]:
        return ()


class TestWorkflowEvaluationArtifact(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.event = self.store_event(data={}, project_id=self.project.id)
        self.group = self.event.group
        assert self.group is not None

        self.event_data = WorkflowEventData(
            event=self.event.for_group(self.group),
            group=self.group,
        )
        self.detector = self.create_detector(project=self.project)

    def _build_evaluation(
        self,
        *,
        triggered: bool = False,
        error: ConditionError | None = None,
        deferred: bool = False,
        workflow_id: int = 10,
        condition_evaluations: list[DataConditionEvaluation] | None = None,
        filter_group_evaluations: list[DataConditionGroupEvaluation] | None = None,
    ) -> WorkflowEvaluation:
        trigger_evaluation = DataConditionGroupEvaluation(
            result=triggered,
            triggered=triggered,
            error=error,
            data={
                "condition_evaluations": condition_evaluations or [],
                "logic_type": DataConditionGroup.Type.ANY,
            },
        )
        return WorkflowEvaluation(
            workflow_id=workflow_id,
            detector_id=self.detector.id,
            detector_type=self.detector.type,
            result=(
                DeferredWorkflowEvaluationResult(
                    delayed_when_group_id=20,
                    delayed_if_group_ids=frozenset({30}),
                    passing_if_group_ids=frozenset({40}),
                )
                if deferred
                else []
            ),
            triggered=triggered,
            error=error,
            data={
                "trigger_group_eval": trigger_evaluation,
                "filter_group_evals": filter_group_evaluations or [],
                "event": self.event_data,
            },
        )

    def _build_batch_result(
        self,
        evaluations: dict[int, WorkflowEvaluation] | None = None,
        *,
        outcome: WorkflowEvaluationOutcome = WorkflowEvaluationOutcome.COMPLETED,
    ) -> ProcessWorkflowsResult:
        return ProcessWorkflowsResult(
            evaluations=evaluations or {},
            outcome=outcome,
            project_id=self.project.id,
            group_id=self.group.id,
            event_id=self.event.event_id,
            detector_id=self.detector.id,
            detector_type=self.detector.type,
        )

    def test_to_artifact_is_self_describing_and_recursive(self) -> None:
        evaluation = self._build_evaluation(
            triggered=True, error=ConditionError(msg="evaluation failed")
        )

        assert asdict(evaluation.to_artifact()) == {
            "triggered": True,
            "error": "evaluation failed",
            "evaluation_type": EvaluationType.WORKFLOW,
            "evaluation_phase": EvaluationPhase.INITIAL,
            "workflow_id": 10,
            "detector_id": self.detector.id,
            "detector_type": self.detector.type,
            "project_id": self.project.id,
            "event_id": self.event.event_id,
            "group_id": self.group.id,
            "outcome": WorkflowEvaluationOutcome.ERROR,
            "triggered_action_ids": [],
            "delayed": None,
            "trigger_evaluation": {
                "triggered": True,
                "error": "evaluation failed",
                "logic_type": DataConditionGroup.Type.ANY.value,
                "result": True,
                "condition_evaluations": [],
            },
            "filter_evaluations": [],
        }

    def test_process_result_returns_workflow_artifact_dataclasses(self) -> None:
        evaluation = self._build_evaluation()

        artifacts = self._build_batch_result(
            {evaluation.workflow_id: evaluation}
        ).evaluation_artifacts()

        assert artifacts == (evaluation.to_artifact(),)
        assert isinstance(artifacts[0], WorkflowEvaluationArtifact)

    def test_to_artifact_includes_deferred_conditions(self) -> None:
        evaluation = self._build_evaluation(deferred=True)

        artifact = asdict(evaluation.to_artifact())

        assert artifact["outcome"] == WorkflowEvaluationOutcome.DEFERRED
        assert artifact["delayed"] == {
            "trigger_group_id": 20,
            "filter_group_ids": [30],
            "passing_filter_group_ids": [40],
        }

    def test_deferred_outcome_takes_precedence_over_error(self) -> None:
        evaluation = self._build_evaluation(
            deferred=True,
            error=ConditionError(msg="fast condition failed"),
        )

        assert evaluation.outcome == WorkflowEvaluationOutcome.DEFERRED

    def test_action_filter_error_sets_error_outcome(self) -> None:
        filter_evaluation = DataConditionGroupEvaluation(
            result=False,
            triggered=False,
            error=ConditionError(msg="action filter failed"),
            data={
                "condition_evaluations": [],
                "logic_type": DataConditionGroup.Type.ANY,
            },
        )
        evaluation = self._build_evaluation(
            triggered=True,
            filter_group_evaluations=[filter_evaluation],
        )

        assert evaluation.outcome == WorkflowEvaluationOutcome.ERROR

    def test_condition_artifact_excludes_raw_input_data(self) -> None:
        condition = self.create_data_condition()
        condition.update(comparison={"value": 10, "interval": "1h"})
        evaluation = DataConditionEvaluation(
            condition=condition,
            result=True,
            triggered=True,
            data={"email": "user@example.com"},
        )

        artifact = asdict(evaluation.to_artifact())

        assert artifact == {
            "triggered": True,
            "error": None,
            "comparison": '{"interval":"1h","value":10}',
            "condition_id": condition.id,
            "condition_type": condition.type,
            "input_type": "dict",
            "input": None,
            "result": True,
        }
        assert "user@example.com" not in str(artifact)

    def test_logging_redacts_raw_input_data(self) -> None:
        artifact: dict[str, object] = {
            "trigger_evaluation": {
                "condition_evaluations": [
                    {
                        "input": {"email": "user@example.com"},
                        "input_type": "dict",
                    }
                ]
            }
        }

        assert redact_pii_from_artifact(artifact) == {
            "trigger_evaluation": {"condition_evaluations": [{"input": None, "input_type": "dict"}]}
        }

    def test_emitter_redacts_raw_workflow_event_input(self) -> None:
        condition = self.create_data_condition()
        condition_evaluation = DataConditionEvaluation(
            condition=condition,
            result=True,
            triggered=True,
            data=self.event_data,
        )
        evaluation = self._build_evaluation(
            triggered=True,
            condition_evaluations=[condition_evaluation],
        )

        with (
            Feature({"organizations:workflow-engine-log-evaluations": True}),
            override_options({"workflow_engine.evaluation_logs_direct_to_sentry": False}),
            mock.patch(f"{LOGGING_MODULE}.logger") as mock_logger,
        ):
            emit_evaluations(
                organization=self.organization,
                result=self._build_batch_result({evaluation.workflow_id: evaluation}),
            )

        logged_condition = mock_logger.info.call_args.kwargs["extra"]["trigger_evaluation"][
            "condition_evaluations"
        ][0]
        assert logged_condition["input"] is None
        assert logged_condition["input_type"] == "WorkflowEventData"

    def test_condition_artifact_includes_string_input(self) -> None:
        condition = self.create_data_condition()
        evaluation = DataConditionEvaluation(
            condition=condition,
            result=True,
            triggered=True,
            data="production",
        )

        assert evaluation.to_artifact().input == "production"

    def test_emitter_always_logs_with_feature_enabled(self) -> None:
        evaluation = self._build_evaluation()
        with (
            Feature({"organizations:workflow-engine-log-evaluations": True}),
            override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 0.0,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ),
            mock.patch(f"{LOGGING_MODULE}.logger") as mock_logger,
        ):
            emit_evaluations(
                organization=self.organization,
                result=self._build_batch_result({10: evaluation}),
            )

        mock_logger.info.assert_called_once()

    def test_should_log_targeted_workflow(self) -> None:
        evaluation = self._build_evaluation(workflow_id=10)
        with (
            Feature({"organizations:workflow-engine-log-evaluations": False}),
            override_options(
                {
                    "workflow_engine.evaluation_log_target_workflow_ids": [10],
                    "workflow_engine.evaluation_log_sample_rate": 0.0,
                }
            ),
        ):
            assert should_log(
                self.organization,
                self._build_batch_result({10: evaluation}),
            )

    def test_emitter_respects_sample_rate_when_feature_disabled(self) -> None:
        evaluation = self._build_evaluation()
        with (
            Feature({"organizations:workflow-engine-log-evaluations": False}),
            override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 0.1,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ),
            mock.patch(f"{LOGGING_MODULE}.random.random", side_effect=[0.05, 0.15]),
            mock.patch(f"{LOGGING_MODULE}.logger") as mock_logger,
        ):
            emit_evaluations(
                organization=self.organization,
                result=self._build_batch_result({10: evaluation}),
            )
            emit_evaluations(
                organization=self.organization,
                result=self._build_batch_result({10: evaluation}),
            )

        mock_logger.info.assert_called_once()

    def test_emitter_logs_artifact_to_sentry_logger(self) -> None:
        evaluation = self._build_evaluation(triggered=True)
        with (
            Feature({"organizations:workflow-engine-log-evaluations": True}),
            override_options({"workflow_engine.evaluation_logs_direct_to_sentry": True}),
            mock.patch(f"{LOGGING_MODULE}.sdk_logger") as mock_sentry_logger,
        ):
            emit_evaluations(
                organization=self.organization,
                result=self._build_batch_result({10: evaluation}),
            )

        mock_sentry_logger.info.assert_called_once_with(
            "workflow_engine.process_workflows.evaluation",
            attributes={
                **asdict(evaluation.to_artifact()),
                "organization_id": self.organization.id,
            },
        )

    def test_emitter_logs_each_workflow_evaluation(self) -> None:
        evaluations = {
            10: self._build_evaluation(workflow_id=10),
            11: self._build_evaluation(workflow_id=11),
        }
        with (
            Feature({"organizations:workflow-engine-log-evaluations": True}),
            override_options({"workflow_engine.evaluation_logs_direct_to_sentry": False}),
            mock.patch(f"{LOGGING_MODULE}.logger") as mock_logger,
        ):
            emit_evaluations(
                organization=self.organization,
                result=self._build_batch_result(evaluations),
            )

        assert mock_logger.info.call_count == 2
        assert [
            call.kwargs["extra"]["workflow_id"] for call in mock_logger.info.call_args_list
        ] == [
            10,
            11,
        ]

    def test_emitter_logs_empty_delayed_batch_outcome(self) -> None:
        with (
            Feature({"organizations:workflow-engine-log-evaluations": True}),
            mock.patch(f"{LOGGING_MODULE}.logger") as mock_logger,
        ):
            emit_evaluations(
                organization=self.organization,
                result=EmptyDelayedWorkflowEvaluationBatch(),
            )

        mock_logger.info.assert_called_once_with(
            "workflow_engine.process_workflows.evaluation",
            extra={
                "evaluation_type": EvaluationType.WORKFLOW,
                "evaluation_phase": EvaluationPhase.DELAYED,
                "outcome": WorkflowEvaluationOutcome.NO_WORKFLOWS,
                "error": None,
                "organization_id": self.organization.id,
            },
        )

    def test_emitter_logs_empty_batch_outcome(self) -> None:
        result = self._build_batch_result(
            outcome=WorkflowEvaluationOutcome.NO_WORKFLOWS,
        )
        assert result.evaluation_artifacts() == ()

        with (
            Feature({"organizations:workflow-engine-log-evaluations": True}),
            mock.patch(f"{LOGGING_MODULE}.logger") as mock_logger,
        ):
            emit_evaluations(
                organization=self.organization,
                result=result,
            )

        mock_logger.info.assert_called_once_with(
            "workflow_engine.process_workflows.evaluation",
            extra={
                "evaluation_type": EvaluationType.WORKFLOW,
                "evaluation_phase": EvaluationPhase.INITIAL,
                "outcome": WorkflowEvaluationOutcome.NO_WORKFLOWS,
                "project_id": self.project.id,
                "group_id": self.group.id,
                "event_id": self.event.event_id,
                "detector_id": self.detector.id,
                "detector_type": self.detector.type,
                "error": None,
                "organization_id": self.organization.id,
            },
        )

    def test_eap_emitter_stores_compact_issue_state(self) -> None:
        condition = self.create_data_condition()
        condition.update(comparison={"email": "customer@example.com"})
        condition_evaluation = DataConditionEvaluation(
            condition=condition,
            result=True,
            triggered=True,
            data="customer@example.com",
        )
        self.group.status = GroupStatus.RESOLVED
        self.event_data = WorkflowEventData(
            event=self.event.for_group(self.group),
            group=self.group,
            group_state={
                "id": self.group.id,
                "is_new": True,
                "is_regression": False,
                "is_new_group_environment": True,
            },
            has_escalated=True,
        )
        evaluation = self._build_evaluation(
            triggered=True,
            condition_evaluations=[condition_evaluation],
        )

        storage = MemoryMessageStorage[KafkaPayload]()
        broker = LocalBroker(storage)
        topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"])
        broker.create_topic(topic, partitions=1)

        with mock.patch(
            "sentry.workflow_engine.processors.evaluations.eap._eap_producer",
            broker.get_producer(),
        ):
            emit_evaluation_to_eap(
                self.organization,
                self._build_batch_result({evaluation.workflow_id: evaluation}),
            )

        message = broker.consume(Partition(topic, 0), 0)
        assert message is not None
        trace_item = EAP_ITEMS_CODEC.decode(message.payload.value)

        assert trace_item.organization_id == self.organization.id
        assert trace_item.project_id == self.project.id
        assert trace_item.item_type == TraceItemType.TRACE_ITEM_TYPE_LOG
        assert trace_item.attributes["event_id"].string_value == self.event.event_id
        assert trace_item.attributes["event_kind"].string_value == "group_event"
        assert trace_item.attributes["is_new"].bool_value is True
        assert trace_item.attributes["is_regression"].bool_value is False
        assert trace_item.attributes["is_resolved"].bool_value is True
        assert trace_item.attributes["has_escalated"].bool_value is True

        def values_by_key(value: Any) -> dict[str, Any]:
            return {item.key: item.value for item in value.kvlist_value.values}

        trigger_evaluation = values_by_key(trace_item.attributes["trigger_evaluation"])
        conditions = trigger_evaluation["condition_evaluations"].array_value.values
        stored_condition = values_by_key(conditions[0])
        assert "comparison" not in stored_condition
        assert "input" not in stored_condition

    def test_eap_emitter_stores_empty_detector_outcome(self) -> None:
        result = ProcessDetectorsResult(
            detector_id=self.detector.id,
            detector_type=self.detector.type,
            project_id=self.project.id,
            evaluations={},
        )
        storage = MemoryMessageStorage[KafkaPayload]()
        broker = LocalBroker(storage)
        topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"])
        broker.create_topic(topic, partitions=1)

        with mock.patch(
            "sentry.workflow_engine.processors.evaluations.eap._eap_producer",
            broker.get_producer(),
        ):
            emit_evaluation_to_eap(self.organization, result)

        message = broker.consume(Partition(topic, 0), 0)
        assert message is not None
        trace_item = EAP_ITEMS_CODEC.decode(message.payload.value)

        assert trace_item.attributes["evaluation_type"].string_value == "detector"
        assert trace_item.attributes["detector_id"].int_value == self.detector.id
        assert trace_item.attributes["outcome"].string_value == "no_results"
