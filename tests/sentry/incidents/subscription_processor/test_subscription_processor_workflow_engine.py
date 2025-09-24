"""
Dual processing tests for the workflow engine/legacy system. This file will be cleaned up
after we fully migrate away from metric alerts.
"""

from datetime import timedelta
from unittest import mock
from unittest.mock import ANY, MagicMock, call, patch

import orjson
from django.utils import timezone
from urllib3.response import HTTPResponse

from sentry.conf.server import SEER_ANOMALY_DETECTION_ENDPOINT_URL
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.logic import (
    WARNING_TRIGGER_LABEL,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
)
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import IncidentStatus, TriggerStatus
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
    AnomalyType,
    DetectAnomaliesResponse,
)
from sentry.seer.anomaly_detection.utils import translate_direction
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.utils import json
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.incidents.subscription_processor.test_subscription_processor import (
    ProcessUpdateAnomalyDetectionTest,
    ProcessUpdateComparisonAlertTest,
)


@freeze_time()
class ProcessUpdateWorkflowEngineTest(ProcessUpdateComparisonAlertTest):
    @with_feature("organizations:workflow-engine-metric-alert-dual-processing-logs")
    @with_feature("organizations:workflow-engine-metric-alert-processing")
    @patch("sentry.incidents.subscription_processor.metrics")
    @patch("sentry.incidents.subscription_processor.logger")
    def test_alert_metrics_logging(self, mock_logger: MagicMock, mock_metrics: MagicMock) -> None:
        """
        Test that we are logging when we enter workflow engine at the same rate as we store a metric for firing an alert
        """
        rule = self.rule
        trigger = self.trigger
        detector = self.create_detector(name="hojicha", type=MetricIssue.slug)
        data_source = self.create_data_source(source_id=str(self.sub.id))
        data_source.detectors.set([detector])
        self.create_alert_rule_detector(alert_rule_id=rule.id, detector=detector)
        # create a warning trigger
        warning_trigger = create_alert_rule_trigger(
            self.rule, WARNING_TRIGGER_LABEL, trigger.alert_threshold - 1
        )
        value = trigger.alert_threshold + 1
        self.send_update(rule, value)

        mock_logger.info.assert_any_call(
            "dual processing results for alert rule",
            extra={
                "results": [],
                "num_results": 0,
                "value": value,
                "rule_id": rule.id,
            },
        )

        mock_logger.info.assert_any_call(
            "subscription_processor.alert_triggered",
            extra={
                "rule_id": rule.id,
                "detector_id": detector.id,
                "organization_id": rule.organization_id,
                "project_id": self.project.id,
                "aggregation_value": value,
                "trigger_id": warning_trigger.id,
            },
        )
        # assert that we only create a metric for `dual_processing.alert_rules.fire` once despite having 2 triggers
        mock_metrics.incr.assert_has_calls(
            [
                call(
                    "incidents.alert_rules.threshold.alert",
                    tags={"detection_type": "static"},
                ),
                call(
                    "dual_processing.alert_rules.fire",
                ),
                call("incidents.alert_rules.trigger", tags={"type": "fire"}),
                call(
                    "incidents.alert_rules.threshold.alert",
                    tags={"detection_type": "static"},
                ),
                call("incidents.alert_rules.trigger", tags={"type": "fire"}),
            ],
        )

    @with_feature("organizations:workflow-engine-metric-alert-dual-processing-logs")
    @with_feature("organizations:workflow-engine-metric-alert-processing")
    @patch("sentry.incidents.subscription_processor.metrics")
    @patch("sentry.incidents.subscription_processor.logger")
    def test_snoozed_alert_metrics_logging(
        self, mock_logger: MagicMock, mock_metrics: MagicMock
    ) -> None:
        """
        Test that we are logging when we enter workflow engine at the same rate as we store a metric for firing a snoozed alert
        """
        rule = self.rule
        trigger = self.trigger
        detector = self.create_detector(name="hojicha", type=MetricIssue.slug)
        data_source = self.create_data_source(source_id=str(self.sub.id))
        data_source.detectors.set([detector])
        self.create_alert_rule_detector(alert_rule_id=rule.id, detector=detector)
        # create a warning trigger
        create_alert_rule_trigger(self.rule, WARNING_TRIGGER_LABEL, trigger.alert_threshold - 1)
        self.snooze_rule(owner_id=self.user.id, alert_rule=rule)
        self.send_update(rule, trigger.alert_threshold + 1)
        mock_logger.info.assert_any_call(
            "dual processing results for alert rule",
            extra={
                "results": [],
                "num_results": 0,
                "value": trigger.alert_threshold + 1,
                "rule_id": rule.id,
            },
        )
        mock_metrics.incr.assert_has_calls(
            [
                call(
                    "incidents.alert_rules.threshold.alert",
                    tags={"detection_type": "static"},
                ),
                call("incidents.alert_rules.trigger", tags={"type": "fire"}),
                call(
                    "incidents.alert_rules.threshold.alert",
                    tags={"detection_type": "static"},
                ),
                call("incidents.alert_rules.trigger", tags={"type": "fire"}),
            ],
        )

    @with_feature("organizations:workflow-engine-metric-alert-dual-processing-logs")
    @with_feature("organizations:workflow-engine-metric-alert-processing")
    @patch("sentry.incidents.subscription_processor.metrics")
    @patch("sentry.incidents.subscription_processor.logger")
    def test_resolve_metrics_logging(self, mock_logger: MagicMock, mock_metrics: MagicMock) -> None:
        rule = self.rule
        detector = self.create_detector(name="hojicha", type=MetricIssue.slug)
        data_source = self.create_data_source(source_id=str(self.sub.id))
        data_source.detectors.set([detector])
        self.create_alert_rule_detector(alert_rule_id=rule.id, detector=detector)
        trigger = self.trigger
        self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-2))

        # resolve the rule
        mock_logger.reset_mock()
        mock_metrics.reset_mock()
        resolve_value = rule.resolve_threshold - 1
        self.send_update(rule, resolve_value, timedelta(minutes=-1))
        mock_metrics.incr.assert_has_calls(
            [
                call(
                    "incidents.alert_rules.threshold.resolve",
                    tags={"detection_type": "static"},
                ),
                call(
                    "dual_processing.alert_rules.resolve",
                ),
                call("incidents.alert_rules.trigger", tags={"type": "resolve"}),
            ]
        )

        mock_logger.info.assert_any_call(
            "dual processing results for alert rule",
            extra={
                "results": [],
                "num_results": 0,
                "value": resolve_value,
                "rule_id": rule.id,
            },
        )
        mock_logger.info.assert_any_call(
            "subscription_processor.alert_triggered",
            extra={
                "rule_id": rule.id,
                "detector_id": detector.id,
                "organization_id": rule.organization_id,
                "project_id": self.project.id,
                "aggregation_value": resolve_value,
                "trigger_id": trigger.id,
            },
        )

    @with_feature("organizations:workflow-engine-metric-alert-dual-processing-logs")
    @with_feature("organizations:workflow-engine-metric-alert-processing")
    @patch("sentry.incidents.subscription_processor.metrics")
    @patch("sentry.incidents.subscription_processor.logger")
    def test_snoozed_resolve_metrics_logging(
        self, mock_logger: MagicMock, mock_metrics: MagicMock
    ) -> None:
        rule = self.rule
        self.snooze_rule(owner_id=self.user.id, alert_rule=rule)
        detector = self.create_detector(name="hojicha", type=MetricIssue.slug)
        data_source = self.create_data_source(source_id=str(self.sub.id))
        data_source.detectors.set([detector])
        self.create_alert_rule_detector(alert_rule_id=rule.id, detector=detector)
        trigger = self.trigger
        self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-2))

        # resolve the rule
        mock_logger.reset_mock()
        mock_metrics.reset_mock()
        resolve_value = rule.resolve_threshold - 1
        self.send_update(rule, resolve_value, timedelta(minutes=-1))
        mock_metrics.incr.assert_has_calls(
            [
                call(
                    "incidents.alert_rules.threshold.resolve",
                    tags={"detection_type": "static"},
                ),
                call("incidents.alert_rules.trigger", tags={"type": "resolve"}),
            ]
        )
        mock_logger.info.assert_any_call(
            "dual processing results for alert rule",
            extra={
                "results": [],
                "num_results": 0,
                "value": resolve_value,
                "rule_id": rule.id,
            },
        )

    @patch("sentry.incidents.subscription_processor.metrics")
    def test_alert(self, mock_metrics: MagicMock) -> None:
        # Verify that an alert rule that only expects a single update to be over the
        # alert threshold triggers correctly
        rule = self.rule
        trigger = self.trigger
        processor = self.send_update(rule, trigger.alert_threshold + 1)
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        assert incident.date_started == (
            timezone.now().replace(microsecond=0) - timedelta(seconds=rule.snuba_query.time_window)
        )
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        latest_activity = self.latest_activity(incident)
        uuid = str(latest_activity.notification_uuid)
        self.assert_actions_fired_for_incident(
            incident,
            [self.action],
            [
                {
                    "action": self.action,
                    "incident": incident,
                    "project": self.project,
                    "new_status": IncidentStatus.CRITICAL,
                    "metric_value": trigger.alert_threshold + 1,
                    "notification_uuid": uuid,
                }
            ],
        )
        mock_metrics.incr.assert_has_calls(
            [
                call(
                    "incidents.alert_rules.threshold.alert",
                    tags={"detection_type": "static"},
                ),
                call("incidents.alert_rules.trigger", tags={"type": "fire"}),
            ],
        )

    @patch("sentry.incidents.subscription_processor.metrics")
    def test_resolve(self, mock_metrics: MagicMock) -> None:
        # Verify that an alert rule that only expects a single update to be under the
        # resolve threshold triggers correctly
        rule = self.rule
        trigger = self.trigger
        processor = self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-2))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [self.action],
            [
                {
                    "action": self.action,
                    "incident": incident,
                    "project": self.project,
                    "new_status": IncidentStatus.CRITICAL,
                    "metric_value": trigger.alert_threshold + 1,
                    "notification_uuid": mock.ANY,
                }
            ],
        )

        processor = self.send_update(rule, rule.resolve_threshold - 1, timedelta(minutes=-1))
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, self.trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [self.action],
            [
                {
                    "action": self.action,
                    "incident": incident,
                    "project": self.project,
                    "new_status": IncidentStatus.CLOSED,
                    "metric_value": rule.resolve_threshold - 1,
                    "notification_uuid": mock.ANY,
                }
            ],
        )
        mock_metrics.incr.assert_has_calls(
            [
                call(
                    "incidents.alert_rules.threshold.alert",
                    tags={"detection_type": "static"},
                ),
                call("incidents.alert_rules.trigger", tags={"type": "fire"}),
                call(
                    "incidents.alert_rules.threshold.resolve",
                    tags={"detection_type": "static"},
                ),
                call("incidents.alert_rules.trigger", tags={"type": "resolve"}),
            ]
        )

    @with_feature("organizations:workflow-engine-metric-alert-processing")
    @patch("sentry.incidents.subscription_processor.process_data_packet")
    def test_process_data_packet_called(self, mock_process_data_packet: MagicMock) -> None:
        rule = self.rule
        detector = self.create_detector(name="hojicha", type=MetricIssue.slug)
        data_source = self.create_data_source(source_id=str(self.sub.id))
        data_source.detectors.set([detector])
        self.send_update(rule, 10)
        assert mock_process_data_packet.call_count == 1
        assert (
            mock_process_data_packet.call_args_list[0][0][1] == DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
        )
        data_packet = mock_process_data_packet.call_args_list[0][0][0]
        assert data_packet.source_id == str(self.sub.id)
        assert data_packet.packet.values == {"value": 10}

    @with_feature("organizations:workflow-engine-metric-alert-processing")
    @patch("sentry.incidents.subscription_processor.process_data_packet")
    @patch("sentry.incidents.subscription_processor.get_comparison_aggregation_value")
    def test_process_data_packet_not_called(
        self, mock_get_comparison_aggregation_value, mock_process_data_packet
    ):
        rule = self.comparison_rule_above
        trigger = self.trigger

        detector = self.create_detector(name="hojicha", type=MetricIssue.slug)
        data_source = self.create_data_source(source_id=str(self.sub.id))
        data_source.detectors.set([detector])

        mock_get_comparison_aggregation_value.return_value = None
        self.send_update(
            rule, trigger.alert_threshold + 1, timedelta(minutes=-10), subscription=self.sub
        )
        assert mock_process_data_packet.call_count == 0

    @with_feature("organizations:workflow-engine-single-process-metric-issues")
    @patch("sentry.incidents.subscription_processor.process_data_packet")
    def test_single_processing_no_trigger(self, mock_process_data_packet: MagicMock) -> None:
        """
        If an organization is flagged into single processing, then data should not flow through
        the legacy system.
        """
        rule = self.rule
        trigger = self.trigger

        detector = self.create_detector(name="hojicha", type=MetricIssue.slug)
        data_source = self.create_data_source(source_id=str(self.sub.id))
        data_source.detectors.set([detector])

        processor = self.send_update(rule, trigger.alert_threshold + 1)
        self.assert_trigger_counts(processor, self.trigger, 0, 0)
        self.assert_no_active_incident(rule)

        assert mock_process_data_packet.call_count == 1
        assert (
            mock_process_data_packet.call_args_list[0][0][1] == DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
        )
        data_packet = mock_process_data_packet.call_args_list[0][0][0]
        assert data_packet.source_id == str(self.sub.id)
        assert data_packet.packet.values == {"value": trigger.alert_threshold + 1}

    @with_feature("organizations:workflow-engine-single-process-metric-issues")
    @patch("sentry.incidents.subscription_processor.metrics")
    def test_process_update__single_processing__sends_metrics(self, mock_metric):
        # Replicate the rule to a detector
        self.detector = self.create_detector(type=MetricIssue.slug)
        self.detector.workflow_condition_group = self.create_data_condition_group(logic_type="any")
        self.condition = self.create_data_condition(
            condition_group=self.detector.workflow_condition_group,
            type="gt",
            comparison=100.0,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        self.data_source = self.create_data_source(source_id=str(self.sub.id))
        self.data_source.detectors.set([self.detector])
        self.data_source.save()
        self.detector.save()

        # Process the rule with single workflow engine processing flag
        self.send_update(self.rule, self.trigger.alert_threshold + 1)

        # Ensure that single processing metric is sent
        mock_metric.incr.assert_any_call("incidents.workflow_engine.processing.single")

    @with_feature("organizations:workflow-engine-metric-alert-processing")
    @patch("sentry.incidents.subscription_processor.logger")
    def test_process_update__dual_processing__result_log(self, mock_logger):
        self.detector = self.create_detector(type=MetricIssue.slug)
        self.detector.workflow_condition_group = self.create_data_condition_group(logic_type="any")
        self.condition = self.create_data_condition(
            condition_group=self.detector.workflow_condition_group,
            type="gt",
            comparison=100.0,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        self.data_source = self.create_data_source(source_id=str(self.sub.id))
        self.data_source.detectors.set([self.detector])
        self.data_source.save()
        self.detector.save()

        self.send_update(self.rule, self.trigger.alert_threshold + 1)

        # Log should indicate both systems triggered
        mock_logger.info.assert_any_call(
            "incidents.workflow_engine.processing",
            extra={
                "detector": self.detector,
                "workflow_engine_triggered": True,
                "metric_alert_triggered": True,
            },
        )


@freeze_time()
class ProcessUpdateAnomalyDetectionWorkflowEngineTest(ProcessUpdateAnomalyDetectionTest):
    def get_seer_return_value(
        self, anomaly_score: float, value: int, anomaly_type: AnomalyType, success: bool = True
    ) -> DetectAnomaliesResponse:
        seer_return_value: DetectAnomaliesResponse = {
            "success": success,
            "timeseries": [
                {
                    "anomaly": {
                        "anomaly_score": anomaly_score,
                        "anomaly_type": anomaly_type.value,
                    },
                    "timestamp": 1,
                    "value": value,
                }
            ],
        }
        return seer_return_value

    def assert_seer_results(
        self, mock_seer_request: MagicMock, rule: AlertRule, value: int
    ) -> None:
        assert mock_seer_request.call_args.args[0] == "POST"
        assert mock_seer_request.call_args.args[1] == SEER_ANOMALY_DETECTION_ENDPOINT_URL
        deserialized_body = json.loads(mock_seer_request.call_args.kwargs["body"])
        assert deserialized_body["organization_id"] == self.sub.project.organization.id
        assert deserialized_body["project_id"] == self.sub.project_id
        assert deserialized_body["config"]["time_period"] == rule.snuba_query.time_window / 60
        assert rule.sensitivity is not None
        assert deserialized_body["config"]["sensitivity"] == rule.sensitivity
        assert rule.seasonality is not None
        assert deserialized_body["config"]["expected_seasonality"] == rule.seasonality
        assert rule.threshold_type is not None
        assert deserialized_body["config"]["direction"] == translate_direction(rule.threshold_type)
        assert deserialized_body["context"]["cur_window"]["value"] == value
        assert deserialized_body["context"]["source_id"] == self.sub.id

    def create_workflow_engine_models(self, rule: AlertRule) -> None:
        data_condition_group = self.create_data_condition_group()
        detector = self.create_detector(
            name="hojicha",
            type=MetricIssue.slug,
            config={
                "detection_type": AlertRuleDetectionType.DYNAMIC,
                "sensitivity": AlertRuleSensitivity.HIGH,
                "seasonality": AlertRuleSeasonality.AUTO,
                "threshold_period": rule.threshold_period,
            },
            workflow_condition_group=data_condition_group,
        )
        data_source = self.create_data_source(source_id=str(self.sub.id))
        data_source.detectors.set([detector])
        self.create_workflow(organization=self.organization)
        comparison = {
            "sensitivity": AnomalyDetectionSensitivity.HIGH,
            "seasonality": AnomalyDetectionSeasonality.AUTO,
            "threshold_type": AnomalyDetectionThresholdType.ABOVE_AND_BELOW,
        }
        self.create_data_condition(
            condition_group=data_condition_group,
            type=Condition.ANOMALY_DETECTION,
            comparison=comparison,
            condition_result=DetectorPriorityLevel.HIGH,
        )

    @patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    @with_feature("organizations:incidents")
    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:workflow-engine-metric-alert-processing")
    def test_seer_call_dual_processing__warning(self, mock_seer_request: MagicMock) -> None:
        rule = self.dynamic_rule
        trigger = self.trigger
        warning_trigger = create_alert_rule_trigger(rule, WARNING_TRIGGER_LABEL, 0)
        create_alert_rule_trigger_action(
            warning_trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            str(self.user.id),
        )
        self.create_workflow_engine_models(rule)
        value = 5
        seer_return_value = self.get_seer_return_value(
            anomaly_score=0.7, value=value, anomaly_type=AnomalyType.LOW_CONFIDENCE
        )
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        processor = self.send_update(rule, value, timedelta(minutes=-3))

        self.assert_seer_results(mock_seer_request, rule, value)
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, warning_trigger, 0, 0)
        self.assert_no_active_incident(rule)  # there is no warning for dynamic alerts

    @patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    @with_feature("organizations:incidents")
    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:workflow-engine-metric-alert-processing")
    def test_seer_call_dual_processing__critical(self, mock_seer_request: MagicMock) -> None:
        rule = self.dynamic_rule
        trigger = self.trigger
        warning_trigger = create_alert_rule_trigger(rule, WARNING_TRIGGER_LABEL, 0)
        warning_action = create_alert_rule_trigger_action(
            warning_trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            str(self.user.id),
        )
        self.create_workflow_engine_models(rule)
        value = 10

        seer_return_value = self.get_seer_return_value(
            anomaly_score=0.9, value=value, anomaly_type=AnomalyType.HIGH_CONFIDENCE
        )
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        processor = self.send_update(rule, value, timedelta(minutes=-2))

        self.assert_seer_results(mock_seer_request, rule, value)
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, warning_trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.ACTIVE)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
        self.assert_actions_fired_for_incident(
            incident,
            [warning_action],
            [
                {
                    "action": warning_action,
                    "incident": incident,
                    "project": self.project,
                    "new_status": IncidentStatus.CRITICAL,
                    "metric_value": 10,
                    "notification_uuid": mock.ANY,
                },
            ],
        )

    @patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    @with_feature("organizations:incidents")
    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:workflow-engine-metric-alert-processing")
    def test_seer_call_dual_processing__resolution(self, mock_seer_request: MagicMock) -> None:
        rule = self.dynamic_rule
        trigger = self.trigger
        warning_trigger = create_alert_rule_trigger(rule, WARNING_TRIGGER_LABEL, 0)
        warning_action = create_alert_rule_trigger_action(
            warning_trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.USER,
            str(self.user.id),
        )
        self.create_workflow_engine_models(rule)

        # trigger critical first
        crit_value = 10
        seer_return_value = self.get_seer_return_value(
            anomaly_score=0.9, value=crit_value, anomaly_type=AnomalyType.HIGH_CONFIDENCE
        )
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        processor = self.send_update(rule, crit_value, timedelta(minutes=-2))
        incident = self.assert_active_incident(rule)

        # trigger a resolution
        resolve_value = 1
        seer_return_value_resolve = self.get_seer_return_value(
            anomaly_score=0.5, value=resolve_value, anomaly_type=AnomalyType.NONE
        )
        mock_seer_request.return_value = HTTPResponse(
            orjson.dumps(seer_return_value_resolve), status=200
        )
        processor = self.send_update(rule, resolve_value, timedelta(minutes=-1))

        self.assert_seer_results(mock_seer_request, rule, resolve_value)
        self.assert_trigger_counts(processor, trigger, 0, 0)
        self.assert_trigger_counts(processor, warning_trigger, 0, 0)
        self.assert_no_active_incident(rule)
        self.assert_trigger_exists_with_status(incident, warning_trigger, TriggerStatus.RESOLVED)
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.RESOLVED)
        self.assert_actions_resolved_for_incident(
            incident,
            [warning_action],
            [
                {
                    "action": warning_action,
                    "incident": incident,
                    "project": self.project,
                    "new_status": IncidentStatus.CLOSED,
                    "metric_value": 1,
                    "notification_uuid": mock.ANY,
                },
            ],
        )

    @with_feature("organizations:incidents")
    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:workflow-engine-metric-alert-processing")
    @with_feature("organizations:workflow-engine-metric-alert-dual-processing-logs")
    @patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    @patch("sentry.incidents.subscription_processor.metrics")
    @patch("sentry.incidents.subscription_processor.logger")
    def test_anomaly_detection_metrics_logging(
        self, mock_logger: MagicMock, mock_metrics: MagicMock, mock_seer_request: MagicMock
    ) -> None:
        rule = self.dynamic_rule
        trigger = self.trigger
        create_alert_rule_trigger(rule, WARNING_TRIGGER_LABEL, 0)
        self.create_workflow_engine_models(rule)
        detector = Detector.objects.get(name="hojicha")
        value = 10

        seer_return_value = self.get_seer_return_value(
            anomaly_score=0.9, value=value, anomaly_type=AnomalyType.HIGH_CONFIDENCE
        )
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        self.send_update(rule, value, timedelta(minutes=-2))

        # assert that we only create a metric for `dual_processing.alert_rules.fire` once despite having 2 triggers
        mock_metrics.incr.assert_has_calls(
            [
                call(
                    "incidents.alert_rules.threshold.alert",
                    tags={"detection_type": "dynamic"},
                ),
                call(
                    "dual_processing.alert_rules.fire",
                ),
                call("incidents.alert_rules.trigger", tags={"type": "fire"}),
                call(
                    "incidents.alert_rules.threshold.alert",
                    tags={"detection_type": "dynamic"},
                ),
                call("incidents.alert_rules.trigger", tags={"type": "fire"}),
            ],
        )
        mock_logger.info.assert_any_call(
            "subscription_processor.alert_triggered",
            extra={
                "rule_id": rule.id,
                "detector_id": detector.id,
                "organization_id": rule.organization_id,
                "project_id": self.project.id,
                "aggregation_value": value,
                "trigger_id": trigger.id,
            },
        )
        # this one gets called twice, once per trigger
        mock_logger.info.assert_any_call(
            "dual processing anomaly detection alert",
            extra={
                "rule_id": rule.id,
                "detector_id": detector.id,
                "anomaly_evaluation": True,
            },
        )
        mock_logger.info.assert_any_call(
            "dual processing results for alert rule",
            extra={
                "results": ANY,
                "num_results": 1,
                "value": value,
                "rule_id": rule.id,
            },
        )

    @with_feature("organizations:incidents")
    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:workflow-engine-metric-alert-processing")
    @with_feature("organizations:workflow-engine-metric-alert-dual-processing-logs")
    @patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    @patch("sentry.incidents.subscription_processor.metrics")
    @patch("sentry.incidents.subscription_processor.logger")
    def test_snoozed_anomaly_detection_metrics_logging(
        self, mock_logger: MagicMock, mock_metrics: MagicMock, mock_seer_request: MagicMock
    ) -> None:
        rule = self.dynamic_rule
        self.snooze_rule(owner_id=self.user.id, alert_rule=rule)
        create_alert_rule_trigger(rule, WARNING_TRIGGER_LABEL, 0)
        self.create_workflow_engine_models(rule)
        detector = Detector.objects.get(name="hojicha")
        value = 10

        seer_return_value = self.get_seer_return_value(
            anomaly_score=0.9, value=value, anomaly_type=AnomalyType.HIGH_CONFIDENCE
        )
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        self.send_update(rule, value, timedelta(minutes=-2))

        mock_metrics.incr.assert_has_calls(
            [
                call(
                    "incidents.alert_rules.threshold.alert",
                    tags={"detection_type": "dynamic"},
                ),
                call("incidents.alert_rules.trigger", tags={"type": "fire"}),
                call(
                    "incidents.alert_rules.threshold.alert",
                    tags={"detection_type": "dynamic"},
                ),
                call("incidents.alert_rules.trigger", tags={"type": "fire"}),
            ],
        )

        # this one gets called twice, once per trigger
        mock_logger.info.assert_any_call(
            "dual processing anomaly detection alert",
            extra={
                "rule_id": rule.id,
                "detector_id": detector.id,
                "anomaly_evaluation": True,
            },
        )
        mock_logger.info.assert_any_call(
            "dual processing results for alert rule",
            extra={
                "results": ANY,
                "num_results": 1,
                "value": value,
                "rule_id": rule.id,
            },
        )

    @with_feature("organizations:incidents")
    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:workflow-engine-metric-alert-processing")
    @with_feature("organizations:workflow-engine-metric-alert-dual-processing-logs")
    @patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    @patch("sentry.incidents.subscription_processor.metrics")
    @patch("sentry.incidents.subscription_processor.logger")
    def test_resolve_anomaly_detection_metrics_logging(
        self, mock_logger: MagicMock, mock_metrics: MagicMock, mock_seer_request: MagicMock
    ) -> None:
        rule = self.dynamic_rule
        trigger = self.trigger
        create_alert_rule_trigger(rule, WARNING_TRIGGER_LABEL, 0)
        self.create_workflow_engine_models(rule)
        detector = Detector.objects.get(name="hojicha")
        value = 10

        seer_return_value = self.get_seer_return_value(
            anomaly_score=0.9, value=value, anomaly_type=AnomalyType.HIGH_CONFIDENCE
        )
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        self.send_update(rule, value, timedelta(minutes=-2))

        # trigger a resolution
        resolve_value = 1
        seer_return_value_resolve = self.get_seer_return_value(
            anomaly_score=0.5, value=resolve_value, anomaly_type=AnomalyType.NONE
        )
        mock_seer_request.return_value = HTTPResponse(
            orjson.dumps(seer_return_value_resolve), status=200
        )
        mock_logger.reset_mock()
        mock_metrics.reset_mock()
        self.send_update(rule, resolve_value, timedelta(minutes=-1))

        # assert that we only create a metric for `dual_processing.alert_rules.resolve` once despite having 2 triggers
        mock_metrics.incr.assert_has_calls(
            [
                call(
                    "incidents.alert_rules.threshold.resolve",
                    tags={"detection_type": "dynamic"},
                ),
                call(
                    "dual_processing.alert_rules.resolve",
                ),
                call("incidents.alert_rules.trigger", tags={"type": "resolve"}),
                call(
                    "incidents.alert_rules.threshold.resolve",
                    tags={"detection_type": "dynamic"},
                ),
                call("incidents.alert_rules.trigger", tags={"type": "resolve"}),
            ],
        )

        mock_logger.info.assert_any_call(
            "dual processing results for alert rule",
            extra={
                "results": ANY,
                "num_results": 1,
                "value": resolve_value,
                "rule_id": rule.id,
            },
        )
        # this one gets called twice, once per trigger
        mock_logger.info.assert_any_call(
            "dual processing anomaly detection alert",
            extra={
                "rule_id": rule.id,
                "detector_id": detector.id,
                "anomaly_evaluation": False,
            },
        )
        mock_logger.info.assert_any_call(
            "subscription_processor.alert_triggered",
            extra={
                "rule_id": rule.id,
                "detector_id": detector.id,
                "organization_id": rule.organization_id,
                "project_id": self.project.id,
                "aggregation_value": resolve_value,
                "trigger_id": trigger.id,
            },
        )

    @with_feature("organizations:incidents")
    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:workflow-engine-metric-alert-processing")
    @with_feature("organizations:workflow-engine-metric-alert-dual-processing-logs")
    @patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    @patch("sentry.incidents.subscription_processor.metrics")
    @patch("sentry.incidents.subscription_processor.logger")
    def test_snoozed_resolve_anomaly_detection_metrics_logging(
        self, mock_logger: MagicMock, mock_metrics: MagicMock, mock_seer_request: MagicMock
    ) -> None:
        rule = self.dynamic_rule
        self.snooze_rule(owner_id=self.user.id, alert_rule=rule)
        create_alert_rule_trigger(rule, WARNING_TRIGGER_LABEL, 0)
        self.create_workflow_engine_models(rule)
        detector = Detector.objects.get(name="hojicha")
        value = 10

        seer_return_value = self.get_seer_return_value(
            anomaly_score=0.9, value=value, anomaly_type=AnomalyType.HIGH_CONFIDENCE
        )
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        self.send_update(rule, value, timedelta(minutes=-2))

        # trigger a resolution
        resolve_value = 1
        seer_return_value_resolve = self.get_seer_return_value(
            anomaly_score=0.5, value=resolve_value, anomaly_type=AnomalyType.NONE
        )
        mock_seer_request.return_value = HTTPResponse(
            orjson.dumps(seer_return_value_resolve), status=200
        )
        mock_logger.reset_mock()
        mock_metrics.reset_mock()
        self.send_update(rule, resolve_value, timedelta(minutes=-1))

        mock_metrics.incr.assert_has_calls(
            [
                call(
                    "incidents.alert_rules.threshold.resolve",
                    tags={"detection_type": "dynamic"},
                ),
                call("incidents.alert_rules.trigger", tags={"type": "resolve"}),
                call(
                    "incidents.alert_rules.threshold.resolve",
                    tags={"detection_type": "dynamic"},
                ),
                call("incidents.alert_rules.trigger", tags={"type": "resolve"}),
            ],
        )

        # this one gets called twice, once per trigger
        mock_logger.info.assert_any_call(
            "dual processing anomaly detection alert",
            extra={
                "rule_id": rule.id,
                "detector_id": detector.id,
                "anomaly_evaluation": False,
            },
        )
        mock_logger.info.assert_any_call(
            "dual processing results for alert rule",
            extra={
                "results": ANY,
                "num_results": 1,
                "value": resolve_value,
                "rule_id": rule.id,
            },
        )
