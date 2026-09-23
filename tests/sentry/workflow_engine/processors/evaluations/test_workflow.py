from concurrent.futures import Future
from dataclasses import asdict
from unittest import mock
from uuid import UUID

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.backends.local.backend import LocalBroker
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.types import BrokerValue, Partition
from arroyo.types import Topic as ArroyoTopic
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.conf.types.kafka_definition import Topic
from sentry.models.activity import Activity
from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import Feature
from sentry.testutils.helpers.options import override_options
from sentry.types.activity import ActivityType
from sentry.utils import json
from sentry.utils.kafka_config import get_topic_definition
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.processors import evaluation_eap
from sentry.workflow_engine.processors.evaluation_logging import (
    emit_workflow_evaluations,
    redact_evaluation_artifact,
    should_log,
)
from sentry.workflow_engine.processors.evaluations import (
    DataConditionEvaluation,
    DataConditionGroupEvaluation,
    DeferredWorkflowEvaluationResult,
    EvaluationPhase,
    EvaluationType,
    ProcessWorkflowsResult,
    WorkflowEvaluation,
    WorkflowEvaluationOutcome,
)
from sentry.workflow_engine.types import ConditionError, WorkflowEventData

LOGGING_MODULE = "sentry.workflow_engine.processors.evaluation_logging"
EAP_MODULE = "sentry.workflow_engine.processors.evaluation_eap"


@pytest.mark.parametrize("value", [None, False, True, 0, 42, 1.5, "production"])
def test_log_projection_preserves_scalar_inputs(value: object) -> None:
    artifact = {"input": value, "input_type": type(value).__name__}
    assert redact_evaluation_artifact(artifact) == artifact


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
        self.eap_storage = MemoryMessageStorage[KafkaPayload]()
        broker = LocalBroker(self.eap_storage)
        self.eap_topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"])
        broker.create_topic(self.eap_topic, partitions=1)
        self.eap_partition = Partition(self.eap_topic, 0)
        self.local_producer = broker.get_producer()
        self.enterContext(
            mock.patch.object(evaluation_eap._eap_producer, "_inner_producer", self.local_producer)
        )

    def _build_evaluation(
        self,
        *,
        triggered: bool = False,
        error: ConditionError | None = None,
        deferred: bool = False,
        workflow_id: int = 10,
        filter_group_evaluations: list[DataConditionGroupEvaluation] | None = None,
    ) -> WorkflowEvaluation:
        trigger_evaluation = DataConditionGroupEvaluation(
            result=triggered,
            triggered=triggered,
            error=error,
            data={
                "condition_evaluations": [],
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

    def _result_with_input(self, value: object) -> ProcessWorkflowsResult:
        condition = DataConditionEvaluation(
            condition=self.create_data_condition(), triggered=True, result=True, data=value
        )
        evaluation = self._build_evaluation(triggered=True)
        evaluation.data["trigger_group_eval"].data["condition_evaluations"].append(condition)
        return self._build_batch_result({10: evaluation})

    def _read_eap_item(self, offset: int = 0) -> TraceItem:
        message = self.eap_storage.consume(self.eap_partition, offset)
        assert message is not None
        return evaluation_eap.EAP_ITEMS_CODEC.decode(message.payload.value)

    def test_eap_and_logs_share_one_full_artifact(self) -> None:
        raw_input = {"nested": [{"email": "user@example.com", "values": [None, False, 0, 1.25]}]}
        result = self._result_with_input(raw_input)
        mock_logger = mock.MagicMock()
        with (
            self.feature(evaluation_eap.EAP_FEATURE),
            override_options({"workflow_engine.evaluation_log_sample_rate": 1.0}),
            mock.patch.object(
                ProcessWorkflowsResult, "evaluation_artifacts", wraps=result.evaluation_artifacts
            ) as mock_build,
            mock.patch(f"{EAP_MODULE}.quotas.backend.get_event_retention", return_value=30),
        ):
            assert emit_workflow_evaluations(
                mock_logger, organization=self.organization, result=result
            )
        mock_build.assert_called_once_with()
        item = self._read_eap_item()
        assert item.item_type == TraceItemType.Value("TRACE_ITEM_TYPE_WORKFLOW_ENGINE_EVALUATION")
        assert item.organization_id == self.organization.id
        assert item.project_id == self.project.id
        assert item.retention_days == 30
        assert item.client_sample_rate == item.server_sample_rate == 1.0
        assert item.timestamp == item.received
        assert len(item.item_id) == 16
        assert UUID(item.trace_id).hex == item.trace_id
        assert item.trace_id != self.event.event_id
        assert item.attributes["workflow_id"].string_value == "10"
        assert item.attributes["artifact_schema_version"].int_value == 1
        full = json.loads(item.attributes["artifact"].string_value)
        assert full["trigger_evaluation"]["condition_evaluations"][0]["input"] == raw_input
        assert mock_logger.info.call_args.kwargs["extra"] == redact_evaluation_artifact(full)
        assert self.eap_storage.consume(self.eap_partition, 1) is None

    def test_eap_enabled_logs_not_sampled(self) -> None:
        result = self._result_with_input([10, 20])
        mock_logger = mock.MagicMock()
        with (
            self.feature(evaluation_eap.EAP_FEATURE),
            override_options({"workflow_engine.evaluation_log_sample_rate": 0.0}),
        ):
            assert not emit_workflow_evaluations(
                mock_logger, organization=self.organization, result=result
            )
        assert self._read_eap_item().attributes["outcome"].string_value == "no_actions"
        mock_logger.info.assert_not_called()

    def test_eap_disabled_logs_sampled(self) -> None:
        result = self._result_with_input({"email": "user@example.com"})
        mock_logger = mock.MagicMock()
        with (
            self.feature({evaluation_eap.EAP_FEATURE: False}),
            override_options({"workflow_engine.evaluation_log_sample_rate": 1.0}),
            mock.patch.object(evaluation_eap, "_serialize_value") as serialize,
        ):
            assert emit_workflow_evaluations(
                mock_logger, organization=self.organization, result=result
            )
        serialize.assert_not_called()
        mock_logger.info.assert_called_once()
        assert "user@example.com" not in str(mock_logger.info.call_args)
        assert self.eap_storage.consume(self.eap_partition, 0) is None

    def test_no_artifact_work_when_both_sinks_disabled(self) -> None:
        result = self._build_batch_result()
        with (
            self.feature({evaluation_eap.EAP_FEATURE: False}),
            override_options({"workflow_engine.evaluation_log_sample_rate": 0.0}),
            mock.patch.object(ProcessWorkflowsResult, "evaluation_artifacts") as build,
        ):
            assert not emit_workflow_evaluations(
                mock.MagicMock(), organization=self.organization, result=result
            )
        build.assert_not_called()
        assert self.eap_storage.consume(self.eap_partition, 0) is None

    def test_eap_gate_uses_the_requested_organization(self) -> None:
        other_org = self.create_organization()
        with mock.patch(f"{EAP_MODULE}.features.has", side_effect=[True, False]) as flag:
            assert (
                evaluation_eap.get_eap_organization(organization=self.organization)
                == self.organization
            )
            assert evaluation_eap.get_eap_organization(organization=other_org) is None
        assert flag.call_args_list == [
            mock.call(evaluation_eap.EAP_FEATURE, self.organization),
            mock.call(evaluation_eap.EAP_FEATURE, other_org),
        ]

    def test_eap_serializes_workflow_event_input_without_sql(self) -> None:
        self.event_data.event.data["user"] = {"email": "user@example.com"}
        result = self._result_with_input(self.event_data)
        artifacts = result.evaluation_artifacts()
        with self.assertNumQueries(0):
            serialized = evaluation_eap._serialize_value(artifacts)
        assert serialized[0]["trigger_evaluation"]["condition_evaluations"][0]["input"]["event"][
            "user"
        ] == {"email": "user@example.com"}
        evaluation_eap.produce_evaluation_artifacts(self.organization, artifacts)
        full = json.loads(self._read_eap_item().attributes["artifact"].string_value)
        snapshot = full["trigger_evaluation"]["condition_evaluations"][0]["input"]
        assert snapshot["group"]["id"] == self.group.id
        assert snapshot["event"]["user"]["email"] == "user@example.com"
        assert snapshot["group_state"] is None
        assert snapshot["workflow_env"] is None

    def test_eap_serializes_activity_input(self) -> None:
        activity = Activity(
            id=7,
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={"email": "user@example.com"},
        )
        result = self._result_with_input(WorkflowEventData(event=activity, group=self.group))
        evaluation_eap.produce_evaluation_artifacts(
            self.organization, result.evaluation_artifacts()
        )
        full = json.loads(self._read_eap_item().attributes["artifact"].string_value)
        snapshot = full["trigger_evaluation"]["condition_evaluations"][0]["input"]
        assert snapshot["event"]["id"] == 7
        assert snapshot["event"]["data"] == {"email": "user@example.com"}
        assert snapshot["event"]["type"] == ActivityType.SET_RESOLVED.value

    def test_eap_preserves_large_ids_and_checks_project_once(self) -> None:
        first = self._build_evaluation(workflow_id=2**53 + 1)
        second = self._build_evaluation(workflow_id=2**53 + 2)
        result = self._build_batch_result({first.workflow_id: first, second.workflow_id: second})
        with mock.patch.object(
            Project.objects, "get_from_cache", return_value=self.project
        ) as lookup:
            evaluation_eap.produce_evaluation_artifacts(
                self.organization, result.evaluation_artifacts()
            )
        lookup.assert_called_once_with(id=self.project.id)
        item = self._read_eap_item()
        assert item.attributes["workflow_id"].string_value == str(2**53 + 1)
        assert json.loads(item.attributes["artifact"].string_value)["workflow_id"] == 2**53 + 1
        second_item = self._read_eap_item(1)
        assert second_item.item_id != item.item_id
        assert second_item.trace_id == item.trace_id

    def test_eap_rejects_cross_org_and_missing_project_scope(self) -> None:
        other_project = self.create_project(organization=self.create_organization())
        artifacts = self._build_batch_result().evaluation_artifacts()
        with mock.patch(f"{EAP_MODULE}.metrics.incr") as metric:
            evaluation_eap.produce_evaluation_artifacts(
                self.organization,
                [
                    {**artifacts[0], "project_id": other_project.id},
                    {**artifacts[0], "project_id": None},
                ],
            )
        assert self.eap_storage.consume(self.eap_partition, 0) is None
        assert metric.call_args_list == [
            mock.call("workflow_engine.evaluation_eap.skipped", tags={"reason": "scope"}),
            mock.call("workflow_engine.evaluation_eap.skipped", tags={"reason": "scope"}),
        ]

    def test_eap_serialization_failure_does_not_suppress_logs_or_other_artifacts(self) -> None:
        result = self._result_with_input(object())
        result.evaluations[11] = self._build_evaluation(workflow_id=11)
        mock_logger = mock.MagicMock()
        with (
            self.feature(evaluation_eap.EAP_FEATURE),
            override_options({"workflow_engine.evaluation_log_sample_rate": 1.0}),
            mock.patch(f"{EAP_MODULE}.metrics.incr") as metric,
        ):
            assert emit_workflow_evaluations(
                mock_logger, organization=self.organization, result=result
            )
        metric.assert_any_call(
            "workflow_engine.evaluation_eap.failed", tags={"stage": "serialization"}
        )
        assert self._read_eap_item().attributes["workflow_id"].string_value == "11"
        assert mock_logger.info.call_count == 2

    def test_eap_enqueue_failure_does_not_suppress_logs(self) -> None:
        mock_logger = mock.MagicMock()
        with (
            self.feature(evaluation_eap.EAP_FEATURE),
            override_options({"workflow_engine.evaluation_log_sample_rate": 1.0}),
            mock.patch.object(self.local_producer, "produce", side_effect=BufferError),
            mock.patch(f"{EAP_MODULE}.metrics.incr") as metric,
        ):
            assert emit_workflow_evaluations(
                mock_logger, organization=self.organization, result=self._build_batch_result()
            )
        metric.assert_any_call("workflow_engine.evaluation_eap.failed", tags={"stage": "enqueue"})
        mock_logger.info.assert_called_once()

    def test_eap_delivery_failure_is_not_tracked_by_the_task(self) -> None:
        future: Future[BrokerValue[KafkaPayload]] = Future()
        with (
            mock.patch.object(self.local_producer, "produce", return_value=future),
            mock.patch(f"{EAP_MODULE}.metrics.incr") as metric,
        ):
            evaluation_eap.produce_evaluation_artifacts(
                self.organization, self._build_batch_result().evaluation_artifacts()
            )
            assert not future.done()
            future.set_exception(RuntimeError("user@example.com"))
        metric.assert_called_once_with(
            "workflow_engine.evaluation_eap.failed", tags={"stage": "delivery"}
        )
        assert (
            evaluation_eap._eap_producer.collect_futures()[evaluation_eap._PRODUCER_NAME] == set()
        )

    def test_eap_gate_failure_is_isolated(self) -> None:
        with (
            mock.patch(f"{EAP_MODULE}.features.has", side_effect=RuntimeError),
            mock.patch(f"{EAP_MODULE}.metrics.incr") as metric,
        ):
            assert evaluation_eap.get_eap_organization(organization=self.organization) is None
        metric.assert_called_once_with(
            "workflow_engine.evaluation_eap.failed", tags={"stage": "gate"}
        )

    def test_artifact_failure_is_isolated(self) -> None:
        with (
            self.feature(evaluation_eap.EAP_FEATURE),
            mock.patch.object(
                ProcessWorkflowsResult, "evaluation_artifacts", side_effect=ValueError
            ),
        ):
            assert not emit_workflow_evaluations(
                mock.MagicMock(), organization=self.organization, result=self._build_batch_result()
            )
        assert self.eap_storage.consume(self.eap_partition, 0) is None

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
            "deferred": None,
            "trigger_evaluation": {
                "triggered": True,
                "error": "evaluation failed",
                "logic_type": DataConditionGroup.Type.ANY.value,
                "result": True,
                "condition_evaluations": [],
            },
            "filter_evaluations": [],
        }

    def test_to_artifact_includes_deferred_conditions(self) -> None:
        evaluation = self._build_evaluation(deferred=True)

        artifact_object = evaluation.to_artifact()
        artifact = artifact_object.to_dict()
        assert artifact == asdict(artifact_object)

        assert artifact["outcome"] == WorkflowEvaluationOutcome.DEFERRED
        assert artifact["deferred"] == {
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

    def test_condition_artifact_preserves_raw_input_data(self) -> None:
        condition = self.create_data_condition()
        condition.update(comparison={"value": 10, "interval": "1h"})
        evaluation = DataConditionEvaluation(
            condition=condition,
            result=True,
            triggered=True,
            data={"email": "user@example.com"},
        )

        artifact = evaluation.to_artifact().to_dict()

        assert artifact == {
            "triggered": True,
            "error": None,
            "comparison": '{"interval":"1h","value":10}',
            "condition_id": condition.id,
            "condition_type": condition.type,
            "input_type": "dict",
            "input": {"email": "user@example.com"},
            "result": True,
        }
        assert artifact["input"] is evaluation.data
        redacted = redact_evaluation_artifact(artifact)
        assert redacted == {**artifact, "input": None}
        assert "user@example.com" not in str(redacted)
        assert artifact["input"] == {"email": "user@example.com"}
        assert redact_evaluation_artifact(redacted) == redacted

    def test_emitter_redacts_mapping_input(self) -> None:
        self._assert_emitter_redacts_input(
            direct_to_sentry=False,
            raw_input={"nested": [{"email": "user@example.com"}]},
        )

    def test_sdk_emitter_redacts_mapping_input(self) -> None:
        self._assert_emitter_redacts_input(
            direct_to_sentry=True,
            raw_input={"nested": [{"email": "user@example.com"}]},
        )

    def test_emitter_redacts_list_input(self) -> None:
        self._assert_emitter_redacts_input(direct_to_sentry=False, raw_input=[10, 20])

    def test_sdk_emitter_redacts_list_input(self) -> None:
        self._assert_emitter_redacts_input(direct_to_sentry=True, raw_input=[10, 20])

    def test_emitter_redacts_event_input(self) -> None:
        self._assert_emitter_redacts_input(direct_to_sentry=False, raw_input=self.event_data)

    def test_sdk_emitter_redacts_event_input(self) -> None:
        self._assert_emitter_redacts_input(direct_to_sentry=True, raw_input=self.event_data)

    def _assert_emitter_redacts_input(self, *, direct_to_sentry: bool, raw_input: object) -> None:
        condition_eval = DataConditionEvaluation(
            condition=self.create_data_condition(),
            triggered=True,
            result=True,
            data=raw_input,
        )
        group_eval = DataConditionGroupEvaluation(
            triggered=True,
            result=True,
            data={"condition_evaluations": [condition_eval], "logic_type": "any"},
        )
        evaluation = self._build_evaluation(filter_group_evaluations=[group_eval])
        evaluation.data["trigger_group_eval"] = group_eval
        result = self._build_batch_result({10: evaluation})
        mock_logger = mock.MagicMock()

        with (
            Feature({"organizations:workflow-engine-log-evaluations": True}),
            override_options(
                {"workflow_engine.evaluation_logs_direct_to_sentry": direct_to_sentry}
            ),
            mock.patch(f"{LOGGING_MODULE}.sdk_logger") as mock_sdk_logger,
            mock.patch.object(
                WorkflowEventData, "__deepcopy__", create=True, side_effect=AssertionError
            ),
            mock.patch.object(
                ProcessWorkflowsResult, "evaluation_artifacts", wraps=result.evaluation_artifacts
            ) as mock_build,
        ):
            assert emit_workflow_evaluations(
                mock_logger, organization=self.organization, result=result
            )

        mock_build.assert_called_once_with()
        selected_logger = mock_sdk_logger if direct_to_sentry else mock_logger
        selected_logger.info.assert_called_once()
        artifact_key = "attributes" if direct_to_sentry else "extra"
        artifact = selected_logger.info.call_args.kwargs[artifact_key]
        assert artifact["trigger_evaluation"]["condition_evaluations"][0]["input"] is None
        assert artifact["filter_evaluations"][0]["condition_evaluations"][0]["input"] is None
        assert "user@example.com" not in str(artifact)
        assert condition_eval.data is raw_input
        trigger_artifact = evaluation.to_artifact().to_dict()["trigger_evaluation"]
        assert isinstance(trigger_artifact, dict)
        assert trigger_artifact["condition_evaluations"][0]["input"] is raw_input

    def test_log_emitter_does_not_mutate_artifacts(self) -> None:
        evaluation = self._build_evaluation()
        result = self._build_batch_result({10: evaluation})
        artifacts = result.evaluation_artifacts()
        with (
            Feature({"organizations:workflow-engine-log-evaluations": True}),
            mock.patch.object(
                ProcessWorkflowsResult, "evaluation_artifacts", return_value=artifacts
            ),
        ):
            emit_workflow_evaluations(
                mock.MagicMock(), organization=self.organization, result=result
            )
        assert "organization_id" not in artifacts[0]

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
        mock_logger = mock.MagicMock()
        with (
            Feature({"organizations:workflow-engine-log-evaluations": True}),
            override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 0.0,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ),
        ):
            assert emit_workflow_evaluations(
                mock_logger,
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
        mock_logger = mock.MagicMock()
        with (
            Feature({"organizations:workflow-engine-log-evaluations": False}),
            override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 0.1,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ),
            mock.patch(f"{LOGGING_MODULE}.random.random", side_effect=[0.05, 0.15]),
        ):
            assert emit_workflow_evaluations(
                mock_logger,
                organization=self.organization,
                result=self._build_batch_result({10: evaluation}),
            )
            assert not emit_workflow_evaluations(
                mock_logger,
                organization=self.organization,
                result=self._build_batch_result({10: evaluation}),
            )

        mock_logger.info.assert_called_once()

    def test_emitter_logs_artifact_to_sentry_logger(self) -> None:
        evaluation = self._build_evaluation(triggered=True)
        mock_logger = mock.MagicMock()
        with (
            Feature({"organizations:workflow-engine-log-evaluations": True}),
            override_options({"workflow_engine.evaluation_logs_direct_to_sentry": True}),
            mock.patch(f"{LOGGING_MODULE}.sdk_logger") as mock_sentry_logger,
        ):
            assert emit_workflow_evaluations(
                mock_logger,
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
        mock_logger.info.assert_not_called()

    def test_emitter_logs_each_workflow_evaluation(self) -> None:
        evaluations = {
            10: self._build_evaluation(workflow_id=10),
            11: self._build_evaluation(workflow_id=11),
        }
        mock_logger = mock.MagicMock()
        with (
            Feature({"organizations:workflow-engine-log-evaluations": True}),
            override_options({"workflow_engine.evaluation_logs_direct_to_sentry": False}),
        ):
            assert emit_workflow_evaluations(
                mock_logger,
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

    def test_emitter_logs_empty_batch_outcome(self) -> None:
        mock_logger = mock.MagicMock()

        with Feature({"organizations:workflow-engine-log-evaluations": True}):
            assert emit_workflow_evaluations(
                mock_logger,
                organization=self.organization,
                result=self._build_batch_result(
                    outcome=WorkflowEvaluationOutcome.NO_WORKFLOWS,
                ),
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
