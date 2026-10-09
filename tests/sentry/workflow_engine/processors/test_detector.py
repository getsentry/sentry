import uuid
from dataclasses import asdict, replace
from datetime import timedelta
from typing import Any
from unittest import mock
from unittest.mock import MagicMock, call, patch

import pytest
from django.db.models import F
from django.utils import timezone

from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.issues.grouptype import FeedbackGroup, PerformanceNPlusOneAPICallsGroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.services.eventstore.models import GroupEvent
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.types.activity import ActivityType
from sentry.utils.cache import cache
from sentry.workflow_engine.defaults.detectors import ensure_default_all_projects_detector
from sentry.workflow_engine.handlers.detector import DetectorHandler
from sentry.workflow_engine.handlers.detector_outcome import DetectorOutcome
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.models.detector_group import DetectorGroup
from sentry.workflow_engine.processors import DetectorEvaluation, ProcessDetectorsResult
from sentry.workflow_engine.processors.detector import (
    EventDetectors,
    associate_new_group_with_detector,
    ensure_association_with_detector,
    get_all_projects_detector,
    get_detectors_for_event_data,
    get_preferred_detector,
    process_detectors,
    query_all_projects_detector,
)
from sentry.workflow_engine.processors.evaluations import (
    DetectorEvaluationArtifact,
    DetectorEvaluationOutcome,
    EvaluationType,
)
from sentry.workflow_engine.processors.evaluations.tracking import emit_evaluations
from sentry.workflow_engine.types import (
    ConditionError,
    DetectorPriorityLevel,
    WorkflowEventData,
)
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType
from tests.sentry.workflow_engine.handlers.detector.test_base import (
    BaseDetectorHandlerTest,
    MockDetectorStateHandler,
    build_mock_group_evaluation,
)


class TestInit(BaseDetectorHandlerTest):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(
            type=self.handler_type.slug,
            workflow_condition_group=self.create_data_condition_group(),
        )
        cache.clear()

    def test_no_caching(self) -> None:
        # Refetch without `.select_related` to make sure that the object isn't cached
        self.detector = Detector.objects.get(id=self.detector.id)
        handler = self.detector.detector_handler
        assert isinstance(handler, DetectorHandler)

        with self.assertNumQueries(1):
            assert handler.condition_group is not None

    def test_caching(self) -> None:
        # Refetch with `.select_related` to make sure that the object iscached
        self.detector = Detector.objects.select_related("workflow_condition_group").get(
            id=self.detector.id
        )
        handler = self.detector.detector_handler
        assert isinstance(handler, DetectorHandler)

        with self.assertNumQueries(0):
            assert handler.condition_group is not None


@freeze_time()
class TestProcessDetectors(BaseDetectorHandlerTest):
    def setUp(self) -> None:
        super().setUp()

    def create_detector_from_cache(self, **kwargs: Any) -> Detector:
        detector = self.create_detector(**kwargs)

        return Detector.objects.annotate(
            project_organization_id=F("project__organization_id"),
        ).get(id=detector.id)

    def build_data_packet(self, **kwargs: Any) -> DataPacket[dict[str, Any]]:
        source_id = "1234"
        return DataPacket[dict[str, Any]](
            source_id, {"source_id": source_id, "group_vals": {"group_1": 6}, **kwargs}
        )

    def test(self) -> None:
        detector = self.create_detector(type=self.handler_type.slug)
        data_packet = self.build_data_packet()
        results = process_detectors(data_packet, [detector])
        assert len(results) == 1
        result_detector, group_results = results[0]
        assert result_detector == detector
        assert set(group_results.keys()) == {None}
        evaluation = group_results[None]
        assert isinstance(evaluation.result, IssueOccurrence)
        assert evaluation.data["group_key"] is None
        assert evaluation.triggered is True
        assert evaluation.priority == DetectorPriorityLevel.HIGH

    def test_logs_canonical_evaluation_artifact(self) -> None:
        detector = self.create_detector_from_cache(type=self.handler_type.slug)
        data_packet = self.build_data_packet(secret="do-not-log")

        with (
            override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 1.0,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ),
            mock.patch(
                "sentry.workflow_engine.processors.evaluations.logging.logger"
            ) as mock_logger,
        ):
            results = process_detectors(data_packet, [detector])

        event_data = results[0][1][None].data["event_data"]
        assert event_data is not None

        mock_logger.info.assert_called_once_with(
            "workflow_engine.process_detectors.evaluation",
            extra={
                "evaluation_type": EvaluationType.DETECTOR,
                "detector_id": detector.id,
                "detector_type": detector.type,
                "project_id": detector.linked_project.id,
                "outcome": DetectorEvaluationOutcome.TRIGGERED,
                "event_id": event_data["event_id"],
                "group_key": None,
                "priority": DetectorPriorityLevel.HIGH.value,
                "trigger_evaluation": {
                    "logic_type": "any",
                    "result": True,
                    "condition_evaluations": [],
                    "triggered": True,
                    "error": None,
                },
                "triggered": True,
                "error": None,
                "organization_id": self.organization.id,
            },
        )
        assert "do-not-log" not in str(mock_logger.info.call_args)

    def test_logs_detector_with_no_evaluation_results(self) -> None:
        detector = self.create_detector_from_cache(type=self.handler_type.slug)
        handler = detector.detector_handler
        assert handler is not None

        with (
            override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 1.0,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ),
            mock.patch.object(type(handler), "_evaluate", return_value={}),
            mock.patch(
                "sentry.workflow_engine.processors.evaluations.logging.logger"
            ) as mock_logger,
        ):
            assert process_detectors(self.build_data_packet(), [detector]) == []

        mock_logger.info.assert_called_once_with(
            "workflow_engine.process_detectors.evaluation",
            extra={
                "evaluation_type": EvaluationType.DETECTOR,
                "detector_id": detector.id,
                "detector_type": detector.type,
                "project_id": detector.linked_project.id,
                "outcome": DetectorEvaluationOutcome.NO_RESULTS,
                "error": None,
                "organization_id": self.organization.id,
            },
        )

    def test_detector_emitter_samples_once_for_grouped_results(self) -> None:
        detector = self.create_stateful_detector()
        handler = detector.detector_handler
        assert handler is not None
        evaluations = handler._evaluate(
            DataPacket("1", {"dedupe": 2, "group_vals": {"group_1": 6, "group_2": 10}})
        )
        with (
            override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 0.5,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ),
            mock.patch(
                "sentry.workflow_engine.processors.evaluations.logging.random.random",
                return_value=0.1,
            ) as mock_random,
            mock.patch(
                "sentry.workflow_engine.processors.evaluations.logging.logger"
            ) as mock_logger,
        ):
            emit_evaluations(
                organization=self.organization,
                result=ProcessDetectorsResult(
                    detector_id=detector.id,
                    detector_type=detector.type,
                    project_id=detector.linked_project.id,
                    evaluations=evaluations,
                ),
            )

        mock_random.assert_called_once_with()
        assert mock_logger.info.call_count == 2
        assert {item.kwargs["extra"]["group_key"] for item in mock_logger.info.call_args_list} == {
            "group_1",
            "group_2",
        }

    def test_detector_emitter_can_log_directly_to_sentry(self) -> None:
        detector = self.create_detector(type=self.handler_type.slug)
        handler = detector.detector_handler
        assert handler is not None
        evaluations = handler._evaluate(self.build_data_packet())
        result = ProcessDetectorsResult(
            detector_id=detector.id,
            detector_type=detector.type,
            project_id=detector.linked_project.id,
            evaluations=evaluations,
        )

        with (
            override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 1.0,
                    "workflow_engine.evaluation_logs_direct_to_sentry": True,
                }
            ),
            mock.patch(
                "sentry.workflow_engine.processors.evaluations.logging.sdk_logger"
            ) as mock_sentry_logger,
        ):
            emit_evaluations(organization=self.organization, result=result)

        mock_sentry_logger.info.assert_called_once_with(
            "workflow_engine.process_detectors.evaluation",
            attributes={
                "evaluation_type": EvaluationType.DETECTOR,
                "detector_id": detector.id,
                "detector_type": detector.type,
                "project_id": detector.linked_project.id,
                **asdict(result.evaluation_artifacts()[0]),
                "organization_id": self.organization.id,
            },
        )

    def test_project_detector_uses_cached_organization_id(self) -> None:
        detector = self.create_detector_from_cache(type=self.handler_type.slug)

        with (
            mock.patch.object(
                Detector,
                "linked_project",
                new_callable=mock.PropertyMock,
                side_effect=AssertionError("project should not be fetched"),
            ),
            mock.patch("sentry.workflow_engine.processors.detector.emit_evaluations") as mock_emit,
        ):
            process_detectors(self.build_data_packet(), [detector])

        assert mock_emit.call_args.kwargs["organization"] == self.organization

    def test_project_detector_with_annotated_organization_id(self) -> None:
        detector = self.create_detector_from_cache(type=self.handler_type.slug)

        with mock.patch("sentry.workflow_engine.processors.detector.emit_evaluations") as mock_emit:
            process_detectors(self.build_data_packet(), [detector])

        assert mock_emit.call_args.kwargs["organization"] == self.organization

    def test_all_projects_detector_uses_config_organization_id(self) -> None:
        detector = self.create_detector(type=self.handler_type.slug)
        detector.update(project=None, config={"organization_id": self.organization.id})
        assert not hasattr(detector, "project_organization_id")

        with mock.patch("sentry.workflow_engine.processors.detector.emit_evaluations") as mock_emit:
            process_detectors(self.build_data_packet(), [detector])

        assert mock_emit.call_args.kwargs["organization"] == self.organization

    def test_all_projects_detector_without_organization_id_does_not_emit(self) -> None:
        detector = self.create_detector(type=self.handler_type.slug)
        detector.update(project=None, config={})

        with mock.patch("sentry.workflow_engine.processors.detector.emit_evaluations") as mock_emit:
            results = process_detectors(self.build_data_packet(), [detector])

        assert [result_detector for result_detector, _ in results] == [detector]
        mock_emit.assert_not_called()

    def test_evaluation_error_sets_process_result_outcome(self) -> None:
        detector = self.create_detector(type=self.handler_type.slug)
        handler = detector.detector_handler
        assert handler is not None
        evaluation = handler._evaluate(self.build_data_packet())[None]
        result = ProcessDetectorsResult(
            detector_id=detector.id,
            detector_type=detector.type,
            project_id=detector.linked_project.id,
            evaluations={None: replace(evaluation, error=ConditionError(msg="evaluation failed"))},
        )

        artifact = result.evaluation_artifacts()[0]
        assert isinstance(artifact, DetectorEvaluationArtifact)
        assert artifact.error == "evaluation failed"
        assert artifact.outcome == DetectorEvaluationOutcome.ERROR
        assert result.outcome == DetectorEvaluationOutcome.ERROR

    def test_detector_emitter_logs_error(self) -> None:
        result = ProcessDetectorsResult(
            detector_id=1,
            detector_type=self.handler_type.slug,
            project_id=None,
            evaluations={},
            error=ConditionError(msg="evaluation failed"),
        )
        assert result.evaluation_artifacts() == ()

        with (
            override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 1.0,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ),
            mock.patch(
                "sentry.workflow_engine.processors.evaluations.logging.logger"
            ) as mock_logger,
        ):
            emit_evaluations(organization=self.organization, result=result)
        mock_logger.info.assert_called_once_with(
            "workflow_engine.process_detectors.evaluation",
            extra={
                "evaluation_type": EvaluationType.DETECTOR,
                "detector_id": 1,
                "detector_type": self.handler_type.slug,
                "project_id": None,
                "outcome": DetectorEvaluationOutcome.ERROR,
                "error": "evaluation failed",
                "organization_id": self.organization.id,
            },
        )

    @mock.patch(
        "sentry.workflow_engine.handlers.detector_outcome.issue_platform.produce_occurrence_to_kafka"
    )
    @mock.patch("sentry.workflow_engine.processors.detector.metrics")
    def test_state_results(
        self, mock_metrics: MagicMock, mock_produce_occurrence_to_kafka: MagicMock
    ) -> None:
        detector = self.create_stateful_detector()
        data_packet = DataPacket("1", {"dedupe": 2, "group_vals": {None: 6}})
        results = process_detectors(data_packet, [detector])

        assert len(results) == 1
        result_detector, group_results = results[0]
        assert result_detector == detector
        assert set(group_results.keys()) == {None}

        evaluation = group_results[None]
        assert isinstance(evaluation.result, IssueOccurrence)
        assert evaluation.triggered is True
        assert evaluation.priority == DetectorPriorityLevel.HIGH

        mock_produce_occurrence_to_kafka.assert_called_once_with(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=evaluation.result,
            status_change=None,
            event_data=evaluation.data["event_data"],
        )
        mock_metrics.incr.assert_any_call(
            "workflow_engine.process_detector.triggered",
            tags={"detector_type": detector.type},
        )

    @mock.patch(
        "sentry.workflow_engine.handlers.detector_outcome.issue_platform.produce_occurrence_to_kafka"
    )
    def test_no_result_does_not_send_to_issue_platform(
        self, mock_produce_occurrence_to_kafka: MagicMock
    ) -> None:
        detector = self.create_stateful_detector()
        evaluation = DetectorEvaluation(
            result=None,
            data={
                "group_key": None,
                "trigger_group_evaluation": build_mock_group_evaluation(),
                "event_data": None,
            },
            triggered=False,
            priority=DetectorPriorityLevel.OK,
        )

        DetectorOutcome.ISSUE_PLATFORM.dispatch(detector, evaluation)
        mock_produce_occurrence_to_kafka.assert_not_called()

    @mock.patch(
        "sentry.workflow_engine.handlers.detector_outcome.issue_platform.produce_occurrence_to_kafka"
    )
    def test_on_complete_override_calls_handler(
        self, mock_produce_occurrence_to_kafka: MagicMock
    ) -> None:
        detector = self.create_stateful_detector()
        data_packet = DataPacket("1", {"dedupe": 2, "group_vals": {None: 6}})

        callback = MagicMock()

        def on_complete(
            handler: MockDetectorStateHandler,
            completed_detector: Detector,
            evaluation: DetectorEvaluation,
        ) -> None:
            callback(handler, completed_detector, evaluation)

        with mock.patch.object(MockDetectorStateHandler, "on_complete", on_complete):
            results = process_detectors(data_packet, [detector])

        assert len(results) == 1
        callback.assert_called_once()
        callback_handler, callback_detector, callback_evaluation = callback.call_args.args
        assert isinstance(callback_handler, MockDetectorStateHandler)
        assert callback_handler.detector == detector
        assert callback_detector == detector
        assert callback_evaluation == results[0][1][None]
        mock_produce_occurrence_to_kafka.assert_not_called()

    @mock.patch(
        "sentry.workflow_engine.handlers.detector_outcome.issue_platform.produce_occurrence_to_kafka"
    )
    def test_state_results_multi_group(self, mock_produce_occurrence_to_kafka: MagicMock) -> None:
        detector = self.create_stateful_detector()
        data_packet = DataPacket("1", {"dedupe": 2, "group_vals": {"group_1": 6, "group_2": 10}})
        results = process_detectors(data_packet, [detector])

        assert len(results) == 1
        result_detector, group_results = results[0]
        assert result_detector == detector
        assert set(group_results.keys()) == {"group_1", "group_2"}
        assert all(
            isinstance(evaluation.result, IssueOccurrence) for evaluation in group_results.values()
        )

        mock_produce_occurrence_to_kafka.assert_has_calls(
            [
                call(
                    payload_type=PayloadType.OCCURRENCE,
                    occurrence=evaluation.result,
                    status_change=None,
                    event_data=evaluation.data["event_data"],
                )
                for evaluation in group_results.values()
            ],
            any_order=True,
        )

    def test_no_handler(self) -> None:
        detector = self.create_detector(type=self.no_handler_type.slug)
        data_packet = self.build_data_packet()
        with mock.patch("sentry.workflow_engine.models.detector.logger") as mock_logger:
            with pytest.raises(ValueError):
                results = process_detectors(data_packet, [detector])
                assert (
                    mock_logger.error.call_args[0][0]
                    == "Registered grouptype for detector has no detector_handler"
                )

                assert results == []

    def test_sending_metric_before_evaluating(self) -> None:
        detector = self.create_detector(type=self.handler_type.slug)
        data_packet = self.build_data_packet()

        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            process_detectors(data_packet, [detector])

            mock_incr.assert_any_call(
                "workflow_engine.process_detector",
                tags={"detector_type": detector.type},
            )
            mock_incr.assert_any_call(
                "workflow_engine_detector.evaluation",
                tags={"detector_type": detector.type, "result": "success"},
                sample_rate=1.0,
            )

    @mock.patch(
        "sentry.workflow_engine.handlers.detector_outcome.issue_platform.produce_occurrence_to_kafka"
    )
    @mock.patch("sentry.workflow_engine.processors.detector.metrics")
    def test_metrics_resolved(
        self,
        mock_metrics: mock.MagicMock,
        mock_produce_occurrence_to_kafka: mock.MagicMock,
    ) -> None:
        detector = self.create_stateful_detector()
        process_detectors(DataPacket("1", {"dedupe": 2, "group_vals": {None: 6}}), [detector])

        results = process_detectors(
            DataPacket("1", {"dedupe": 3, "group_vals": {None: 0}}), [detector]
        )

        assert len(results) == 1
        result_detector, group_results = results[0]
        assert result_detector == detector
        assert set(group_results.keys()) == {None}

        status_change = group_results[None].result
        assert isinstance(status_change, StatusChangeMessage)
        assert status_change.fingerprint == [f"detector:{detector.id}"]
        assert status_change.new_status == GroupStatus.RESOLVED

        assert mock_produce_occurrence_to_kafka.call_args == call(
            payload_type=PayloadType.STATUS_CHANGE,
            occurrence=None,
            status_change=status_change,
            event_data=None,
        )
        mock_metrics.incr.assert_any_call(
            "workflow_engine.process_detector.resolved",
            tags={"detector_type": detector.type},
        )

    def test_doesnt_send_metric(self) -> None:
        detector = self.create_detector(type=self.no_handler_type.slug)
        data_packet = self.build_data_packet()

        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            with pytest.raises(ValueError):
                process_detectors(data_packet, [detector])

                calls = mock_incr.call_args_list
                # We can have background threads emitting metrics as tasks are scheduled
                filtered_calls = list(filter(lambda c: "taskworker" not in c.args[0], calls))
                assert len(filtered_calls) == 0


class TestGetDetectorsForEvent(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.group = self.create_group(project=self.project, type=MetricIssue.type_id)
        self.detector = self.create_detector(project=self.project, type=MetricIssue.slug)
        self.error_detector = self.create_detector(project=self.project, type=ErrorGroupType.slug)
        self.issue_stream_detector = self.create_detector(
            project=self.project, type=IssueStreamGroupType.slug
        )
        self.event = self.store_event(project_id=self.project.id, data={})
        self.occurrence = IssueOccurrence(
            id=uuid.uuid4().hex,
            project_id=1,
            event_id="asdf",
            fingerprint=["asdf"],
            issue_title="title",
            subtitle="subtitle",
            resource_id=None,
            evidence_data={"detector_id": self.detector.id},
            evidence_display=[],
            type=MetricIssue,
            detection_time=timezone.now(),
            level="error",
            culprit="",
        )
        self.group_event = GroupEvent.from_event(self.event, self.group)

    def test_activity_update(self) -> None:
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            user_id=self.user.id,
        )
        event_data = WorkflowEventData(event=activity, group=self.group)
        result = get_detectors_for_event_data(event_data, detector=self.detector)
        assert result is not None
        assert result.preferred_detector == self.detector
        assert result.detectors == {self.issue_stream_detector, self.detector}

    def test_error_group_type(self) -> None:
        # default behavior for a group type is to pick up the issue stream detector
        self.group.update(type=ErrorGroupType.type_id)
        event_data = WorkflowEventData(event=self.group_event, group=self.group)
        result = get_detectors_for_event_data(event_data)
        assert result is not None
        assert result.preferred_detector == self.error_detector
        assert result.detectors == {self.issue_stream_detector, self.error_detector}

    def test_metric_issue(self) -> None:
        self.group_event.occurrence = self.occurrence

        event_data = WorkflowEventData(event=self.group_event, group=self.group)
        result = get_detectors_for_event_data(event_data)
        assert result is not None
        assert result.preferred_detector == self.detector
        assert result.detectors == {self.issue_stream_detector, self.detector}

    def test_metric_issue_with_disable_detector_flag(self) -> None:
        """When the disable-detector flag is set, metric issues should not use the issue stream detector."""
        self.group_event.occurrence = self.occurrence

        event_data = WorkflowEventData(event=self.group_event, group=self.group)
        with self.feature(
            "organizations:workflow-engine-metric-issue-disable-issue-detector-notifications"
        ):
            result = get_detectors_for_event_data(event_data)
        assert result is not None
        assert result.preferred_detector == self.detector
        assert result.detectors == {self.detector}

    def test_non_metric_issue_in_disable_list(self) -> None:
        """Disable override only applies to MetricIssue, not other disabled group types."""
        self.group.update(type=FeedbackGroup.type_id)
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            user_id=self.user.id,
        )
        event_data = WorkflowEventData(event=activity, group=self.group)
        with self.options(
            {
                "workflow_engine.group.type_id.disable_issue_stream_detector": [
                    MetricIssue.type_id,
                    FeedbackGroup.type_id,
                ]
            }
        ):
            result = get_detectors_for_event_data(event_data)
        assert result is None

    @patch("sentry.workflow_engine.processors.detector.logger")
    def test_event_without_detector(self, mock_logger: MagicMock) -> None:
        occurrence = IssueOccurrence(
            id=uuid.uuid4().hex,
            project_id=1,
            event_id="asdf",
            fingerprint=["asdf"],
            issue_title="title",
            subtitle="subtitle",
            resource_id=None,
            evidence_data={},  # no detector id
            evidence_display=[],
            type=PerformanceNPlusOneAPICallsGroupType,
            detection_time=timezone.now(),
            level="error",
            culprit="",
        )
        self.group_event.occurrence = occurrence
        self.group.update(type=PerformanceNPlusOneAPICallsGroupType.type_id)

        event_data = WorkflowEventData(event=self.group_event, group=self.group)
        result = get_detectors_for_event_data(event_data)
        assert result is not None
        assert result.preferred_detector == self.issue_stream_detector
        assert result.detectors == {self.issue_stream_detector}

        # assert no exception is logged
        mock_logger.exception.assert_not_called()

    @patch("sentry.workflow_engine.processors.detector.logger")
    def test_event_missing_detector(self, mock_logger: MagicMock) -> None:
        occurrence = IssueOccurrence(
            id=uuid.uuid4().hex,
            project_id=1,
            event_id="asdf",
            fingerprint=["asdf"],
            issue_title="title",
            subtitle="subtitle",
            resource_id=None,
            evidence_data={"detector_id": 12345},  # missing detector
            evidence_display=[],
            type=PerformanceNPlusOneAPICallsGroupType,
            detection_time=timezone.now(),
            level="error",
            culprit="",
        )
        self.group_event.occurrence = occurrence
        self.group.update(type=PerformanceNPlusOneAPICallsGroupType.type_id)

        event_data = WorkflowEventData(event=self.group_event, group=self.group)
        result = get_detectors_for_event_data(event_data)
        assert result is not None
        assert result.preferred_detector == self.issue_stream_detector
        assert result.detectors == {self.issue_stream_detector}

        # assert no exception is logged
        mock_logger.exception.assert_not_called()

    def test_no_detectors(self) -> None:
        self.issue_stream_detector.delete()
        self.error_detector.delete()
        event_data = WorkflowEventData(event=self.group_event, group=self.group)
        result = get_detectors_for_event_data(event_data)
        assert result is None


class TestQueryAllProjectsDetector(TestCase):
    def test_returns_none_when_missing(self) -> None:
        assert query_all_projects_detector(self.organization.id) is None

    def test_returns_detector_when_exists(self) -> None:
        detector = ensure_default_all_projects_detector(self.organization.id)
        assert query_all_projects_detector(self.organization.id) == detector

    def test_returns_first_when_many_exist(self) -> None:
        with freeze_time(timezone.now() - timedelta(hours=2)):
            first = self.create_all_projects_detector(self.organization)
        with freeze_time(timezone.now() - timedelta(hours=1)):
            _second = self.create_all_projects_detector(self.organization)
        with freeze_time(timezone.now()):
            _third = self.create_all_projects_detector(self.organization)
        result = query_all_projects_detector(self.organization.id)
        assert result is not None
        assert result.id == first.id

    def test_separate_orgs_unaffected(self) -> None:
        org1 = self.create_organization()
        org2 = self.create_organization()
        d1 = ensure_default_all_projects_detector(org1.id)
        d2 = ensure_default_all_projects_detector(org2.id)
        assert query_all_projects_detector(org1.id) == d1
        assert query_all_projects_detector(org2.id) == d2


class TestEventDetectorsAllProject(TestCase):
    def setUp(self) -> None:
        self.issue_stream_detector = self.create_detector(
            project=self.project, type=IssueStreamGroupType.slug
        )
        self.all_projects_detector = ensure_default_all_projects_detector(self.organization.id)

    def test_preferred_detector_prefers_project_scoped(self) -> None:
        ed = EventDetectors(
            issue_stream_detectors=[self.issue_stream_detector, self.all_projects_detector],
        )
        assert ed.preferred_detector == self.issue_stream_detector

    def test_detectors_includes_all_projects(self) -> None:
        ed = EventDetectors(
            issue_stream_detectors=[self.issue_stream_detector, self.all_projects_detector],
        )
        assert self.all_projects_detector in ed.detectors
        assert self.issue_stream_detector in ed.detectors

    def test_only_all_projects_detector_falls_back_to_preferred(self) -> None:
        ed = EventDetectors(issue_stream_detectors=[self.all_projects_detector])
        assert ed.preferred_detector == self.all_projects_detector

    def test_only_all_projects_has_detectors(self) -> None:
        ed = EventDetectors(issue_stream_detectors=[self.all_projects_detector])
        assert ed.has_detectors is True
        assert ed.detectors == {self.all_projects_detector}

    def test_missing_all_projects_detector(self) -> None:
        self.all_projects_detector.delete()
        cache.clear()
        assert get_all_projects_detector(self.organization.id) is None

    def test_many_all_projects_detectors(self) -> None:
        with freeze_time(timezone.now() - timedelta(hours=2)):
            first = self.create_all_projects_detector(self.organization)
        with freeze_time(timezone.now() - timedelta(hours=1)):
            _second = self.create_all_projects_detector(self.organization)
        with freeze_time(timezone.now()):
            _third = self.create_all_projects_detector(self.organization)
        cache.clear()
        result = get_all_projects_detector(self.organization.id)
        assert result is not None
        assert result.id == first.id

    def test_cached_miss_is_invalidated_when_detector_is_created(self) -> None:
        self.all_projects_detector.delete()
        cache.clear()
        assert get_all_projects_detector(self.organization.id) is None

        with self.captureOnCommitCallbacks(execute=True):
            detector = Detector.objects.create(
                project=None,
                type=IssueStreamGroupType.slug,
                config={"organization_id": self.organization.id},
                name="All Projects Detector",
            )

        assert get_all_projects_detector(self.organization.id) == detector

    @patch("sentry.utils.metrics.timer")
    def test_metrics_all_projects_cache(self, mock_timer: MagicMock) -> None:
        cache.clear()
        mock_tags: MagicMock = mock_timer.return_value.__enter__.return_value

        get_all_projects_detector(self.organization.id)
        assert mock.call("cache_hit", "false") in mock_tags.__setitem__.call_args_list
        assert mock.call("detector_found", "true") in mock_tags.__setitem__.call_args_list
        mock_tags.reset_mock()

        get_all_projects_detector(self.organization.id)
        assert mock.call("cache_hit", "true") in mock_tags.__setitem__.call_args_list
        assert mock.call("detector_found", "true") in mock_tags.__setitem__.call_args_list
        mock_tags.reset_mock()

        other_org = self.create_organization()
        result = get_all_projects_detector(other_org.id)
        assert result is None
        assert mock.call("cache_hit", "false") in mock_tags.__setitem__.call_args_list
        assert mock.call("detector_found", "false") in mock_tags.__setitem__.call_args_list
        mock_tags.reset_mock()

        result = get_all_projects_detector(other_org.id)
        assert result is None
        assert mock.call("cache_hit", "true") in mock_tags.__setitem__.call_args_list
        assert mock.call("detector_found", "false") in mock_tags.__setitem__.call_args_list


class TestGetDetectorsForEventAllProject(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.group = self.create_group(project=self.project, type=ErrorGroupType.type_id)
        self.error_detector = self.create_detector(project=self.project, type=ErrorGroupType.slug)
        self.issue_stream_detector = self.create_detector(
            project=self.project, type=IssueStreamGroupType.slug
        )
        from sentry.workflow_engine.defaults.detectors import ensure_default_all_projects_detector

        self.all_projects_detector = ensure_default_all_projects_detector(
            self.project.organization.id
        )
        self.event = self.store_event(project_id=self.project.id, data={})
        self.group_event = GroupEvent.from_event(self.event, self.group)

    def test_omits_all_projects_detector_by_default(self) -> None:
        event_data = WorkflowEventData(event=self.group_event, group=self.group)
        result = get_detectors_for_event_data(event_data)
        assert result is not None
        assert self.all_projects_detector not in result.detectors
        assert result.preferred_detector == self.error_detector

    @override_options({"workflow_engine.all_projects_detectors.rollout-rate": 1.0})
    def test_includes_all_projects_detector_with_option(self) -> None:
        event_data = WorkflowEventData(event=self.group_event, group=self.group)
        result = get_detectors_for_event_data(event_data)
        assert result is not None
        assert self.all_projects_detector in result.detectors
        assert result.preferred_detector == self.error_detector

    @override_options({"workflow_engine.all_projects_detectors.rollout-rate": 1.0})
    def test_missing_all_projects_detector_no_effect(self) -> None:
        self.all_projects_detector.delete()
        event_data = WorkflowEventData(event=self.group_event, group=self.group)
        result = get_detectors_for_event_data(event_data)
        assert result is not None
        assert self.all_projects_detector not in result.detectors
        assert result.preferred_detector == self.error_detector


class TestGetPreferredDetector(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project, type=MetricIssue.type_id)
        self.detector = self.create_detector(project=self.project, type=MetricIssue.slug)
        self.error_detector = self.create_detector(project=self.project, type=ErrorGroupType.slug)
        self.event = self.store_event(project_id=self.project.id, data={})
        self.occurrence = IssueOccurrence(
            id=uuid.uuid4().hex,
            project_id=1,
            event_id="asdf",
            fingerprint=["asdf"],
            issue_title="title",
            subtitle="subtitle",
            resource_id=None,
            evidence_data={"detector_id": self.detector.id},
            evidence_display=[],
            type=MetricIssue,
            detection_time=timezone.now(),
            level="error",
            culprit="",
        )

    def test_with_occurrence(self) -> None:
        group_event = GroupEvent.from_event(self.event, self.group)
        group_event.occurrence = self.occurrence

        event_data = WorkflowEventData(event=group_event, group=self.group)

        result = get_preferred_detector(event_data)

        assert result == self.detector

    def test_without_occurrence(self) -> None:
        self.group.type = ErrorGroupType.type_id
        group_event = GroupEvent.from_event(self.event, self.group)
        group_event.occurrence = None

        event_data = WorkflowEventData(event=group_event, group=self.group)

        result = get_preferred_detector(event_data)

        assert result == self.error_detector

    def test_activity(self) -> None:
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            user_id=self.user.id,
        )
        DetectorGroup.objects.create(detector=self.detector, group=self.group)

        event_data = WorkflowEventData(event=activity, group=self.group)

        result = get_preferred_detector(event_data)

        assert result == self.detector

    def test_issue_stream_detector_fallback(self) -> None:
        # falls back to issue stream
        occurrence = IssueOccurrence(
            id=uuid.uuid4().hex,
            project_id=self.project.id,
            event_id="asdf",
            fingerprint=["asdf"],
            issue_title="title",
            subtitle="subtitle",
            resource_id=None,
            evidence_data={},
            evidence_display=[],
            type=PerformanceNPlusOneAPICallsGroupType,
            detection_time=timezone.now(),
            level="error",
            culprit="",
        )

        group_event = GroupEvent.from_event(self.event, self.group)
        self.group.update(type=PerformanceNPlusOneAPICallsGroupType.type_id)
        group_event.occurrence = occurrence

        event_data = WorkflowEventData(event=group_event, group=self.group)

        detector = get_preferred_detector(event_data)
        assert detector == Detector.get_issue_stream_detector_for_project(self.project.id)


class TestAssociateNewGroupWithDetector(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.metric_detector = self.create_detector(project=self.project, type="metric_issue")
        self.error_detector = self.create_detector(project=self.project, type="error")

    def test_metrics_group_with_known_detector(self) -> None:
        group = self.create_group(project=self.project, type=MetricIssue.type_id)

        # Should return True and create DetectorGroup
        assert associate_new_group_with_detector(group, self.metric_detector.id)
        assert DetectorGroup.objects.filter(
            detector_id=self.metric_detector.id, group_id=group.id
        ).exists()

    def test_error_group_with_feature_disabled(self) -> None:
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)

        with self.options({"workflow_engine.associate_error_detectors": False}):
            assert not associate_new_group_with_detector(group)
            assert not DetectorGroup.objects.filter(group_id=group.id).exists()

    def test_error_group_with_feature_enabled(self) -> None:
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)

        with self.options({"workflow_engine.associate_error_detectors": True}):
            assert associate_new_group_with_detector(group)
            assert DetectorGroup.objects.filter(
                detector_id=self.error_detector.id, group_id=group.id
            ).exists()

    def test_feedback_group_returns_false(self) -> None:
        group = self.create_group(project=self.project, type=FeedbackGroup.type_id)
        assert not associate_new_group_with_detector(group)
        assert not DetectorGroup.objects.filter(group_id=group.id).exists()

    def test_deleted_detector_creates_null_association(self) -> None:
        group = self.create_group(project=self.project, type=MetricIssue.type_id)
        deleted_detector_id = self.metric_detector.id

        self.metric_detector.delete()

        assert associate_new_group_with_detector(group, deleted_detector_id)

        detector_group = DetectorGroup.objects.get(group_id=group.id)
        assert detector_group.detector_id is None
        assert detector_group.group_id == group.id

    @patch("sentry.workflow_engine.processors.detector.metrics")
    def test_error_group_with_missing_error_detector(self, mock_metrics: MagicMock) -> None:
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)
        self.error_detector.delete()

        with self.options({"workflow_engine.associate_error_detectors": True}):
            # Should return False and not raise an exception
            assert not associate_new_group_with_detector(group)
            assert not DetectorGroup.objects.filter(group_id=group.id).exists()

        mock_metrics.incr.assert_called_once_with(
            "workflow_engine.associate_new_group_with_detector",
            tags={"group_type": group.type, "result": "error_detector_not_found"},
        )


class TestEnsureAssociationWithDetector(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.metric_detector = self.create_detector(project=self.project, type="metric_issue")
        self.error_detector = self.create_detector(project=self.project, type="error")
        self.options_context = self.options({"workflow_engine.ensure_detector_association": True})
        self.options_context.__enter__()

    def tearDown(self) -> None:
        self.options_context.__exit__(None, None, None)
        super().tearDown()

    def test_feature_disabled_returns_false(self) -> None:
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)

        with self.options({"workflow_engine.ensure_detector_association": False}):
            assert not ensure_association_with_detector(group)
            assert not DetectorGroup.objects.filter(group_id=group.id).exists()

    def test_already_exists_returns_true(self) -> None:
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)
        DetectorGroup.objects.create(detector=self.error_detector, group=group)

        assert ensure_association_with_detector(group)
        assert DetectorGroup.objects.filter(group_id=group.id).count() == 1

    def test_error_group_creates_association(self) -> None:
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)

        assert ensure_association_with_detector(group)
        detector_group = DetectorGroup.objects.get(group_id=group.id)
        assert detector_group.detector_id == self.error_detector.id
        assert detector_group.group_id == group.id

    def test_metric_group_with_detector_id(self) -> None:
        group = self.create_group(project=self.project, type=MetricIssue.type_id)

        assert ensure_association_with_detector(group, self.metric_detector.id)
        detector_group = DetectorGroup.objects.get(group_id=group.id)
        assert detector_group.detector_id == self.metric_detector.id
        assert detector_group.group_id == group.id

    def test_feedback_group_returns_false(self) -> None:
        group = self.create_group(project=self.project, type=FeedbackGroup.type_id)

        assert not ensure_association_with_detector(group)
        assert not DetectorGroup.objects.filter(group_id=group.id).exists()

    def test_deleted_detector_creates_null_association(self) -> None:
        group = self.create_group(project=self.project, type=MetricIssue.type_id)
        deleted_detector_id = self.metric_detector.id

        self.metric_detector.delete()

        assert ensure_association_with_detector(group, deleted_detector_id)

        detector_group = DetectorGroup.objects.get(group_id=group.id)
        assert detector_group.detector_id is None
        assert detector_group.group_id == group.id

    def test_backdates_date_added_to_group_first_seen(self) -> None:
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)

        assert ensure_association_with_detector(group)
        detector_group = DetectorGroup.objects.get(group_id=group.id)
        assert detector_group.date_added == group.first_seen

    def test_race_condition_handled(self) -> None:
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)

        assert ensure_association_with_detector(group)
        assert ensure_association_with_detector(group)
        assert DetectorGroup.objects.filter(group_id=group.id).count() == 1

    def test_detector_not_found(self) -> None:
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)
        self.error_detector.delete()

        assert not ensure_association_with_detector(group)
        assert not DetectorGroup.objects.filter(group_id=group.id).exists()
