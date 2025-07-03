from datetime import timedelta
from unittest import mock, skip
from unittest.mock import MagicMock, call, patch

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
from sentry.issues.grouptype import MetricIssuePOC
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
from sentry.types.group import PriorityLevel
from sentry.utils import json
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
    def test_alert_metrics_logging(self, mock_logger, mock_metrics):
        """
        Test that we are logging when we enter workflow engine at the same rate as we store a metric for firing an alert
        """
        rule = self.rule
        trigger = self.trigger
        # create a warning trigger
        create_alert_rule_trigger(self.rule, WARNING_TRIGGER_LABEL, trigger.alert_threshold - 1)
        self.send_update(rule, trigger.alert_threshold + 1)
        logger_extra = {
            "results": [],
            "num_results": 0,
            "value": trigger.alert_threshold + 1,
            "rule_id": rule.id,
        }
        assert mock_logger.info.call_count == 1
        mock_logger.info.assert_called_with(
            "dual processing results for alert rule",
            extra=logger_extra,
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
    @patch("sentry.incidents.subscription_processor.metrics")
    def test_resolve_metrics(self, mock_metrics):
        rule = self.rule
        trigger = self.trigger
        self.send_update(rule, trigger.alert_threshold + 1, timedelta(minutes=-2))
        self.send_update(rule, rule.resolve_threshold - 1, timedelta(minutes=-1))
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
                    "incidents.alert_rules.threshold.resolve",
                    tags={"detection_type": "static"},
                ),
                call(
                    "dual_processing.alert_rules.resolve",
                ),
                call("incidents.alert_rules.trigger", tags={"type": "resolve"}),
            ]
        )

    @patch("sentry.incidents.subscription_processor.metrics")
    @patch("sentry.incidents.utils.metric_issue_poc.create_or_update_metric_issue")
    def test_alert(self, create_metric_issue_mock, mock_metrics):
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
        create_metric_issue_mock.assert_not_called()
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
    @patch("sentry.incidents.utils.metric_issue_poc.create_or_update_metric_issue")
    def test_resolve(self, create_metric_issue_mock, mock_metrics):
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
        create_metric_issue_mock.assert_not_called()
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

    @with_feature("organizations:metric-issue-poc")
    @with_feature("projects:metric-issue-creation")
    @patch("sentry.incidents.utils.metric_issue_poc.produce_occurrence_to_kafka")
    def test_alert_creates_metric_issue(self, mock_produce_occurrence_to_kafka):
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

        # Verify that a metric issue is created when an alert fires
        mock_produce_occurrence_to_kafka.assert_called_once()
        occurrence = mock_produce_occurrence_to_kafka.call_args.kwargs["occurrence"]
        assert occurrence.type == MetricIssuePOC
        assert occurrence.issue_title == incident.title
        assert occurrence.priority == PriorityLevel.HIGH
        assert occurrence.evidence_data["metric_value"] == trigger.alert_threshold + 1

    @with_feature("organizations:metric-issue-poc")
    @with_feature("projects:metric-issue-creation")
    @patch("sentry.incidents.utils.metric_issue_poc.produce_occurrence_to_kafka")
    def test_resolved_alert_updates_metric_issue(self, mock_produce_occurrence_to_kafka):
        from sentry.models.group import GroupStatus

        # Trigger an incident at critical status
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

        # Check that a metric issue is created
        assert mock_produce_occurrence_to_kafka.call_count == 1
        occurrence = mock_produce_occurrence_to_kafka.call_args.kwargs["occurrence"]
        assert occurrence.type == MetricIssuePOC
        assert occurrence.priority == PriorityLevel.HIGH
        assert occurrence.evidence_data["metric_value"] == trigger.alert_threshold + 1
        mock_produce_occurrence_to_kafka.reset_mock()

        # Resolve the incident
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

        # Verify that the metric issue is updated
        assert mock_produce_occurrence_to_kafka.call_count == 2
        occurrence = mock_produce_occurrence_to_kafka.call_args_list[0][1]["occurrence"]
        assert occurrence.type == MetricIssuePOC
        assert occurrence.priority == PriorityLevel.MEDIUM
        assert occurrence.evidence_data["metric_value"] == rule.resolve_threshold - 1

        status_change = mock_produce_occurrence_to_kafka.call_args_list[1][1]["status_change"]
        assert status_change.new_status == GroupStatus.RESOLVED
        assert occurrence.fingerprint == status_change.fingerprint

    @with_feature("organizations:workflow-engine-metric-alert-processing")
    @patch("sentry.incidents.subscription_processor.process_data_packets")
    def test_process_data_packets_called(self, mock_process_data_packets):
        rule = self.rule
        detector = self.create_detector(name="hojicha", type=MetricIssue.slug)
        data_source = self.create_data_source(source_id=str(self.sub.id))
        data_source.detectors.set([detector])
        self.send_update(rule, 10)
        assert mock_process_data_packets.call_count == 1
        assert (
            mock_process_data_packets.call_args_list[0][0][1]
            == DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
        )
        data_packet_list = mock_process_data_packets.call_args_list[0][0][0]
        assert data_packet_list[0].source_id == str(self.sub.id)
        assert data_packet_list[0].packet["values"] == {"value": 10}

    @with_feature("organizations:workflow-engine-metric-alert-processing")
    @patch("sentry.incidents.subscription_processor.process_data_packets")
    @patch("sentry.incidents.subscription_processor.get_comparison_aggregation_value")
    def test_process_data_packets_not_called(
        self, mock_get_comparison_aggregation_value, mock_process_data_packets
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
        assert mock_process_data_packets.call_count == 0


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
        assert deserialized_body["context"]["source_id"] == self.sub.id
        assert deserialized_body["context"]["cur_window"]["value"] == value

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

    @with_feature("organizations:metric-issue-poc")
    @with_feature("projects:metric-issue-creation")
    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    @patch("sentry.incidents.utils.metric_issue_poc.produce_occurrence_to_kafka")
    def test_dynamic_alert_creates_metric_issue(
        self, mock_produce_occurrence_to_kafka: MagicMock, mock_seer_request: MagicMock
    ):
        rule = self.dynamic_rule
        trigger = self.trigger
        seer_return_value = self.get_seer_return_value(
            anomaly_score=0.9, value=10, anomaly_type=AnomalyType.HIGH_CONFIDENCE
        )
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        processor = self.send_update(rule, trigger.alert_threshold + 1)

        self.assert_trigger_counts(processor, trigger, 0, 0)
        incident = self.assert_active_incident(rule)
        assert incident.date_started == (
            timezone.now().replace(microsecond=0) - timedelta(seconds=rule.snuba_query.time_window)
        )
        self.assert_trigger_exists_with_status(incident, trigger, TriggerStatus.ACTIVE)
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

        # Verify that a metric issue is created when an alert fires
        mock_produce_occurrence_to_kafka.assert_called_once()
        occurrence = mock_produce_occurrence_to_kafka.call_args.kwargs["occurrence"]
        assert occurrence.type == MetricIssuePOC
        assert occurrence.issue_title == incident.title
        assert occurrence.priority == PriorityLevel.HIGH
        assert occurrence.evidence_data["metric_value"] == trigger.alert_threshold + 1

    @patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    @with_feature("organizations:incidents")
    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:workflow-engine-metric-alert-processing")
    @skip("not enabled yet")
    def test_seer_call_dual_processing__warning(self, mock_seer_request: MagicMock):
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
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:workflow-engine-metric-alert-processing")
    @skip("not enabled yet")
    def test_seer_call_dual_processing__critical(self, mock_seer_request: MagicMock):
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
    @with_feature("organizations:anomaly-detection-rollout")
    @with_feature("organizations:workflow-engine-metric-alert-processing")
    @skip("not enabled yet")
    def test_seer_call_dual_processing__resolution(self, mock_seer_request: MagicMock):
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
