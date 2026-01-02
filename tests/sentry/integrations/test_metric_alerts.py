import uuid

import pytest

from sentry.incidents.endpoints.serializers.utils import get_fake_id_from_object_id
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.incidents.models.alert_rule import AlertRuleDetectionType, AlertRuleThresholdType
from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.typings.metric_detector import AlertContext, MetricIssueContext
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.testutils.cases import BaseIncidentsTest, TestCase

pytestmark = pytest.mark.sentry_metrics


def incident_attachment_info_with_metric_value(incident, new_status, metric_value):
    return incident_attachment_info(
        organization=incident.organization,
        alert_context=AlertContext.from_alert_rule_incident(incident.alert_rule),
        metric_issue_context=MetricIssueContext.from_legacy_models(
            incident, new_status, metric_value
        ),
    )


class IncidentAttachmentInfoTest(TestCase, BaseIncidentsTest):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(type=MetricIssue.type_id)

    def test_returns_correct_info_with_workflow_engine_dual_write(self) -> None:
        """
        This tests that we look up the correct incident and alert rule during dual write ACI migration.
        """
        alert_rule = self.create_alert_rule()
        date_started = self.now
        incident = self.create_incident(
            self.organization,
            title="Incident #1",
            projects=[self.project],
            alert_rule=alert_rule,
            status=IncidentStatus.CLOSED.value,
            date_started=date_started,
        )
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        metric_value = 123
        referrer = "metric_alert_custom"
        notification_uuid = str(uuid.uuid4())

        detector = self.create_detector(project=self.project)
        self.create_alert_rule_detector(alert_rule_id=alert_rule.id, detector=detector)

        open_period = (
            GroupOpenPeriod.objects.filter(group=self.group).order_by("-date_started").first()
        )
        assert open_period is not None
        self.create_incident_group_open_period(incident, open_period)

        metric_issue_context = MetricIssueContext.from_legacy_models(
            incident, IncidentStatus.CLOSED, metric_value
        )
        # Setting the open period identifier to the open period id, since we are testing the lookup
        metric_issue_context.open_period_identifier = open_period.id
        metric_issue_context.group = self.group
        assert metric_issue_context.group is not None

        data = incident_attachment_info(
            organization=incident.organization,
            alert_context=AlertContext(
                name=alert_rule.name,
                # Setting the action identifier id to the detector id since that's what the NOA does
                action_identifier_id=detector.id,
                threshold_type=AlertRuleThresholdType(alert_rule.threshold_type),
                detection_type=AlertRuleDetectionType(alert_rule.detection_type),
                comparison_delta=alert_rule.comparison_delta,
                sensitivity=alert_rule.sensitivity,
                resolve_threshold=alert_rule.resolve_threshold,
                alert_threshold=None,
            ),
            metric_issue_context=metric_issue_context,
            notification_uuid=notification_uuid,
            referrer=referrer,
        )

        assert data["title"] == f"Resolved: {alert_rule.name}"
        assert data["status"] == "Resolved"
        assert data["text"] == "123 events in the last 10 minutes"
        # We still build the link using the alert_rule_id and the incident identifier
        assert (
            data["title_link"]
            == f"http://testserver/organizations/baz/alerts/rules/details/{alert_rule.id}/?alert={incident.identifier}&referrer={referrer}&detection_type=static&notification_uuid={notification_uuid}"
        )
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

    def test_returns_correct_info_placeholder_incident(self) -> None:
        """
        Test that we use the fake incident ID to build the title link if no IGOP entry exists (if the detector was not dual written).
        """
        alert_rule = self.create_alert_rule()
        date_started = self.now
        incident = self.create_incident(
            self.organization,
            title="Incident #1",
            projects=[self.project],
            alert_rule=alert_rule,
            status=IncidentStatus.CLOSED.value,
            date_started=date_started,
        )
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        metric_value = 123
        referrer = "metric_alert_custom"
        notification_uuid = str(uuid.uuid4())

        detector = self.create_detector(project=self.project)

        open_period = (
            GroupOpenPeriod.objects.filter(group=self.group).order_by("-date_started").first()
        )
        assert open_period is not None

        metric_issue_context = MetricIssueContext.from_legacy_models(
            incident, IncidentStatus.CLOSED, metric_value
        )
        # Setting the open period identifier to the open period id, since we are testing the lookup
        metric_issue_context.open_period_identifier = open_period.id
        metric_issue_context.group = self.group
        assert metric_issue_context.group is not None

        # XXX: for convenience, we populate the AlertContext with alert rule/incident information. In this test,
        # we're just interested in how the method handles missing AlertRuleDetectors/IGOPs.
        data = incident_attachment_info(
            organization=incident.organization,
            alert_context=AlertContext(
                name=alert_rule.name,
                # Setting the action identifier id to the detector id since that's what the NOA does
                action_identifier_id=detector.id,
                threshold_type=AlertRuleThresholdType(alert_rule.threshold_type),
                detection_type=AlertRuleDetectionType(alert_rule.detection_type),
                comparison_delta=alert_rule.comparison_delta,
                sensitivity=alert_rule.sensitivity,
                resolve_threshold=alert_rule.resolve_threshold,
                alert_threshold=None,
            ),
            metric_issue_context=metric_issue_context,
            notification_uuid=notification_uuid,
            referrer=referrer,
        )

        fake_alert_rule_id = get_fake_id_from_object_id(detector.id)
        fake_incident_identifier = get_fake_id_from_object_id(open_period.id)

        # Build the link using the fake alert_rule_id and the fake incident identifier
        assert (
            data["title_link"]
            == f"http://testserver/organizations/baz/alerts/rules/details/{fake_alert_rule_id}/?alert={fake_incident_identifier}&referrer={referrer}&detection_type=static&notification_uuid={notification_uuid}"
        )
