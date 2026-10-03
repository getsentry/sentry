from concurrent.futures import Future
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from unittest import mock

from arroyo.backends.kafka import FutureTrackingProducer, KafkaPayload
from arroyo.backends.local.backend import LocalBroker
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.types import Partition
from arroyo.types import Topic as ArroyoTopic
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.conf.types.kafka_definition import Topic
from sentry.incidents.utils.types import AnomalyDetectionValues
from sentry.models.group import GroupStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import Feature
from sentry.testutils.helpers.options import override_options
from sentry.utils import json
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
from sentry.workflow_engine.processors.evaluations.detector import DetectorEvaluation
from sentry.workflow_engine.processors.evaluations.eap import (
    EAP_ITEMS_CODEC,
    emit_evaluation_to_eap,
)
from sentry.workflow_engine.processors.evaluations.logging import (
    redact_pii_from_artifact,
    should_log,
)
from sentry.workflow_engine.processors.evaluations.tracking import emit_evaluations
from sentry.workflow_engine.types import (
    ConditionError,
    DetectorPriorityLevel,
    WorkflowEventData,
)

LOGGING_MODULE = "sentry.workflow_engine.processors.evaluations.logging"
TRACKING_MODULE = "sentry.workflow_engine.processors.evaluations.tracking"


@dataclass(frozen=True)
class EmptyDelayedWorkflowEvaluationBatch(WorkflowEvaluationBatch):
    project_id: int | None

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

    def test_logging_filters_dataclass_input_before_copying(self) -> None:
        class SensitiveEmail(str):
            def __deepcopy__(self, memo: object) -> object:
                raise AssertionError("Logging must not copy raw condition input")

        @dataclass
        class SensitiveInput:
            email: str

        condition = self.create_data_condition()
        condition.update(comparison={"value": 10, "interval": "1h"})
        artifact = DataConditionEvaluation(
            condition=condition,
            result=True,
            triggered=True,
            data=SensitiveInput(email=SensitiveEmail("private@example.com")),
        ).to_artifact()

        payload = redact_pii_from_artifact(
            {"trigger_evaluation": {"condition_evaluations": [artifact]}}
        )
        trigger_evaluation = payload["trigger_evaluation"]
        assert isinstance(trigger_evaluation, dict)
        logged_condition = trigger_evaluation["condition_evaluations"][0]
        assert logged_condition["input"] is None
        assert logged_condition["comparison"] == '{"interval":"1h","value":10}'
        assert "private@example.com" not in str(payload)
        assert "private@example.com" not in repr(artifact)

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

    def test_sentry_logger_redacts_detector_input(self) -> None:
        condition = self.create_data_condition()
        evaluation = self._build_evaluation(
            condition_evaluations=[
                DataConditionEvaluation(
                    condition=condition,
                    data={"email": "private@example.com"},
                    result=True,
                    triggered=True,
                )
            ]
        )
        with (
            Feature({"organizations:workflow-engine-log-evaluations": True}),
            override_options({"workflow_engine.evaluation_logs_direct_to_sentry": True}),
            mock.patch(f"{LOGGING_MODULE}.sdk_logger") as mock_sentry_logger,
        ):
            emit_evaluations(
                organization=self.organization,
                result=self._build_batch_result({evaluation.workflow_id: evaluation}),
            )

        payload = mock_sentry_logger.info.call_args.kwargs["attributes"]
        assert payload["trigger_evaluation"]["condition_evaluations"][0]["input"] is None
        assert "private@example.com" not in str(payload)

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
                result=EmptyDelayedWorkflowEvaluationBatch(project_id=self.project.id),
            )

        mock_logger.info.assert_called_once_with(
            "workflow_engine.process_workflows.evaluation",
            extra={
                "evaluation_type": EvaluationType.WORKFLOW,
                "evaluation_phase": EvaluationPhase.DELAYED,
                "outcome": WorkflowEvaluationOutcome.NO_WORKFLOWS,
                "error": None,
                "project_id": self.project.id,
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

    def test_eap_emitter_failure_does_not_interrupt_evaluation_tracking(self) -> None:
        result = self._build_batch_result({10: self._build_evaluation(workflow_id=10)})

        with (
            Feature({"organizations:workflow-engine-evaluation-artifacts-eap": True}),
            mock.patch(f"{TRACKING_MODULE}.emit_evaluation_logs") as mock_emit_logs,
            mock.patch(
                f"{TRACKING_MODULE}.emit_evaluation_to_eap",
                side_effect=TypeError("unsupported artifact"),
            ),
            mock.patch(f"{TRACKING_MODULE}.logger") as mock_logger,
        ):
            emit_evaluations(organization=self.organization, result=result)

        mock_emit_logs.assert_called_once_with(self.organization, result)
        mock_logger.exception.assert_called_once_with(
            "workflow_engine.evaluations.eap.emit_failed",
            extra={"organization_id": self.organization.id},
        )

    def _emit_evaluation_to_eap(
        self, result: ProcessDetectorsResult | WorkflowEvaluationBatch
    ) -> TraceItem:
        storage = MemoryMessageStorage[KafkaPayload]()
        broker = LocalBroker(storage)
        topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"])
        broker.create_topic(topic, partitions=1)
        broker_producer = broker.get_producer()
        local_producer = mock.Mock()
        local_producer.produce.side_effect = broker_producer.produce
        local_producer.close.side_effect = broker_producer.close
        local_producer.get_config.return_value = {}
        producer = FutureTrackingProducer(
            name=f"test.workflow-evaluation.{id(broker)}",
            producer_factory=mock.Mock(return_value=local_producer),
            should_backpressure=False,
        )

        with mock.patch(
            "sentry.workflow_engine.processors.evaluations.eap._eap_producer",
            producer,
        ):
            emit_evaluation_to_eap(self.organization, result)

        message = broker.consume(Partition(topic, 0), 0)
        assert message is not None
        return EAP_ITEMS_CODEC.decode(message.payload.value)

    def test_eap_preserves_detector_operands_and_nulls(self) -> None:
        @dataclass
        class DetectorInput:
            values: list[object]
            metadata: dict[str, object]

        comparison = {"threshold": 10, "fallback": None, "values": [False, None, 0]}
        detector_input = DetectorInput(
            values=[10, None, False, 0],
            metadata={"email": "synthetic@example.com", "missing": None},
        )
        condition = self.create_data_condition()
        condition.update(comparison=comparison)
        condition_evaluation = DataConditionEvaluation(
            condition=condition, data=detector_input, result=False, triggered=False
        )
        detector_evaluation = DetectorEvaluation(
            data={
                "group_key": None,
                "event_data": None,
                "trigger_group_evaluation": DataConditionGroupEvaluation(
                    data={
                        "condition_evaluations": [condition_evaluation],
                        "logic_type": DataConditionGroup.Type.ALL,
                    },
                    result=False,
                    triggered=False,
                ),
            },
            priority=DetectorPriorityLevel.OK,
            triggered=False,
        )
        trace_item = self._emit_evaluation_to_eap(
            ProcessDetectorsResult(
                detector_id=self.detector.id,
                detector_type=self.detector.type,
                project_id=self.project.id,
                evaluations={None: detector_evaluation},
            )
        )

        stored = json.loads(trace_item.attributes["trigger_evaluation"].string_value)[
            "condition_evaluations"
        ][0]
        assert stored["comparison"] == json.dumps(comparison, sort_keys=True)
        assert json.loads(stored["comparison"]) == comparison
        assert stored["input"] == {
            "values": [10, None, False, 0],
            "metadata": {"email": "synthetic@example.com", "missing": None},
        }

    def test_eap_preserves_anomaly_input_timestamp(self) -> None:
        anomaly_input = AnomalyDetectionValues(
            value=12.0,
            source_id="test-source",
            subscription_id="test-subscription",
            timestamp=datetime(2025, 1, 2, 3, 4, 5, 123456, tzinfo=timezone(timedelta(hours=2))),
        )
        condition_evaluation = DataConditionEvaluation(
            condition=self.create_data_condition(),
            data=anomaly_input,
            result=DetectorPriorityLevel.HIGH,
            triggered=True,
        )
        detector_evaluation = DetectorEvaluation(
            data={
                "group_key": None,
                "event_data": None,
                "trigger_group_evaluation": DataConditionGroupEvaluation(
                    data={
                        "condition_evaluations": [condition_evaluation],
                        "logic_type": DataConditionGroup.Type.ALL,
                    },
                    result=True,
                    triggered=True,
                ),
            },
            priority=DetectorPriorityLevel.HIGH,
            triggered=True,
        )
        trace_item = self._emit_evaluation_to_eap(
            ProcessDetectorsResult(
                detector_id=self.detector.id,
                detector_type=self.detector.type,
                project_id=self.project.id,
                evaluations={None: detector_evaluation},
            )
        )

        stored = json.loads(trace_item.attributes["trigger_evaluation"].string_value)[
            "condition_evaluations"
        ][0]
        assert stored["input"] == {
            "value": 12.0,
            "source_id": "test-source",
            "subscription_id": "test-subscription",
            "timestamp": "2025-01-02T03:04:05.123456+02:00",
        }

    def test_eap_minimizes_workflow_event_input(self) -> None:
        environment = self.create_environment(project=self.project)
        event_data = WorkflowEventData(
            event=self.event.for_group(self.group),
            group=self.group,
            group_state={
                "id": self.group.id,
                "is_new": False,
                "is_regression": False,
                "is_new_group_environment": False,
            },
            has_escalated=False,
            workflow_env=environment,
        )
        self.event_data = event_data
        condition = self.create_data_condition()
        condition.update(comparison=False)
        evaluation = self._build_evaluation(
            condition_evaluations=[
                DataConditionEvaluation(
                    condition=condition, data=event_data, result=False, triggered=False
                )
            ]
        )
        trace_item = self._emit_evaluation_to_eap(
            self._build_batch_result({evaluation.workflow_id: evaluation})
        )

        stored = json.loads(trace_item.attributes["trigger_evaluation"].string_value)[
            "condition_evaluations"
        ][0]
        assert stored["comparison"] == "false"
        assert stored["input"] == {
            "group_state": {
                "is_new": False,
                "is_regression": False,
                "is_new_group_environment": False,
            },
            "has_escalated": False,
            "workflow_env": environment.id,
        }
        assert trace_item.attributes["event_id"].string_value == self.event.event_id
        assert trace_item.attributes["group_id"].int_value == self.group.id

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

        trace_item = self._emit_evaluation_to_eap(
            self._build_batch_result({evaluation.workflow_id: evaluation})
        )

        assert trace_item.organization_id == self.organization.id
        assert trace_item.project_id == self.project.id
        assert trace_item.item_type == TraceItemType.TRACE_ITEM_TYPE_WORKFLOW_ENGINE_EVALUATION
        assert "sentry.body" not in trace_item.attributes
        assert "sentry.severity_number" not in trace_item.attributes
        assert "sentry.severity_text" not in trace_item.attributes
        assert trace_item.attributes["event_id"].string_value == self.event.event_id
        assert trace_item.attributes["event_kind"].string_value == "group_event"
        assert trace_item.attributes["is_new"].bool_value is True
        assert trace_item.attributes["is_regression"].bool_value is False
        assert trace_item.attributes["is_resolved"].bool_value is True
        assert trace_item.attributes["has_escalated"].bool_value is True

        trigger_evaluation = json.loads(trace_item.attributes["trigger_evaluation"].string_value)
        stored_condition = trigger_evaluation["condition_evaluations"][0]
        assert stored_condition["condition_id"] == condition.id
        assert stored_condition["result"] is True
        assert json.loads(trace_item.attributes["filter_evaluations"].string_value) == []

    def test_eap_emitter_preserves_filter_and_deferred_evaluations(self) -> None:
        condition = self.create_data_condition()
        condition_evaluation = DataConditionEvaluation(
            condition=condition,
            result=True,
            triggered=True,
            data="synthetic@example.com",
        )
        filter_evaluation = DataConditionGroupEvaluation(
            result=True,
            triggered=True,
            data={
                "condition_evaluations": [condition_evaluation],
                "logic_type": DataConditionGroup.Type.ALL,
            },
        )
        evaluation = self._build_evaluation(
            deferred=True,
            filter_group_evaluations=[filter_evaluation],
        )

        trace_item = self._emit_evaluation_to_eap(
            self._build_batch_result({evaluation.workflow_id: evaluation})
        )

        filters = json.loads(trace_item.attributes["filter_evaluations"].string_value)
        assert filters[0]["result"] is True
        stored_condition = filters[0]["condition_evaluations"][0]
        assert stored_condition["condition_id"] == condition.id
        assert stored_condition["result"] is True
        assert json.loads(trace_item.attributes["delayed"].string_value) == {
            "trigger_group_id": 20,
            "filter_group_ids": [30],
            "passing_filter_group_ids": [40],
        }

    def test_eap_emitter_continues_after_producer_failure(self) -> None:
        producer = mock.Mock()
        producer.produce.side_effect = [RuntimeError("producer unavailable"), None]
        evaluations = {
            10: self._build_evaluation(workflow_id=10),
            11: self._build_evaluation(workflow_id=11),
        }

        with (
            mock.patch("sentry.workflow_engine.processors.evaluations.eap._eap_producer", producer),
            mock.patch("sentry.workflow_engine.processors.evaluations.eap.logger") as mock_logger,
        ):
            emit_evaluation_to_eap(
                self.organization,
                self._build_batch_result(evaluations),
            )

        assert producer.produce.call_count == 2
        mock_logger.exception.assert_called_once_with(
            "workflow_engine.evaluations.eap.produce_failed",
            extra={"organization_id": self.organization.id, "project_id": self.project.id},
        )

    def test_eap_emitter_observes_delivery_failure(self) -> None:
        producer = mock.Mock()
        failed_future: Future[object] = Future()
        failed_future.set_exception(RuntimeError("delivery failed"))
        producer.produce.side_effect = lambda *args, **kwargs: kwargs["callbacks"][0](failed_future)

        with (
            mock.patch("sentry.workflow_engine.processors.evaluations.eap._eap_producer", producer),
            mock.patch("sentry.workflow_engine.processors.evaluations.eap.logger") as mock_logger,
        ):
            emit_evaluation_to_eap(
                self.organization,
                self._build_batch_result({10: self._build_evaluation(workflow_id=10)}),
            )

        mock_logger.exception.assert_called_once_with(
            "workflow_engine.evaluations.eap.delivery_failed",
            extra={"organization_id": self.organization.id, "project_id": self.project.id},
        )

    def test_eap_emitter_stores_empty_delayed_batch_outcome(self) -> None:
        trace_item = self._emit_evaluation_to_eap(
            EmptyDelayedWorkflowEvaluationBatch(project_id=self.project.id)
        )

        assert trace_item.project_id == self.project.id
        assert trace_item.attributes["evaluation_phase"].string_value == "delayed"
        assert trace_item.attributes["outcome"].string_value == "no_workflows"

    def test_eap_emitter_stores_empty_detector_outcome(self) -> None:
        result = ProcessDetectorsResult(
            detector_id=self.detector.id,
            detector_type=self.detector.type,
            project_id=self.project.id,
            evaluations={},
        )
        trace_item = self._emit_evaluation_to_eap(result)

        assert trace_item.attributes["evaluation_type"].string_value == "detector"
        assert trace_item.attributes["detector_id"].int_value == self.detector.id
        assert trace_item.attributes["outcome"].string_value == "no_results"
