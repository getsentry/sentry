import uuid
from datetime import timedelta

import pytest
from django.utils import timezone

from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.incidents.models.alert_rule import AlertRuleDetectionType, AlertRuleThresholdType
from sentry.incidents.models.incident import IncidentStatus, IncidentTrigger
from sentry.incidents.typings.metric_detector import AlertContext, MetricIssueContext
from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.testutils.cases import BaseIncidentsTest, BaseMetricsTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature

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
    def test_returns_correct_info(self) -> None:
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
        data = incident_attachment_info(
            organization=incident.organization,
            alert_context=AlertContext.from_alert_rule_incident(incident.alert_rule),
            metric_issue_context=MetricIssueContext.from_legacy_models(
                incident, IncidentStatus.CLOSED, metric_value
            ),
            notification_uuid=notification_uuid,
            referrer=referrer,
        )

        assert data["title"] == f"Resolved: {alert_rule.name}"
        assert data["status"] == "Resolved"
        assert data["text"] == "123 events in the last 10 minutes"
        assert (
            data["title_link"]
            == f"http://testserver/organizations/baz/alerts/rules/details/{alert_rule.id}/?alert={incident.identifier}&referrer={referrer}&detection_type=static&notification_uuid={notification_uuid}"
        )
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

    @with_feature("organizations:workflow-engine-trigger-actions")
    def test_returns_correct_info_with_workflow_engine_dual_write(self) -> None:
        """
        This tests that we lookup the correct incident and alert rule during dual write ACI migration.
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

    @with_feature("organizations:workflow-engine-ui-links")
    def test_returns_correct_info_with_workflow_engine_ui_links(self) -> None:
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

        metric_issue_context = MetricIssueContext.from_legacy_models(
            incident, IncidentStatus.CLOSED, metric_value
        )
        metric_issue_context.group = self.group
        assert metric_issue_context.group is not None

        data = incident_attachment_info(
            organization=incident.organization,
            alert_context=AlertContext.from_alert_rule_incident(incident.alert_rule),
            metric_issue_context=metric_issue_context,
            notification_uuid=notification_uuid,
            referrer=referrer,
        )

        assert data["title"] == f"Resolved: {alert_rule.name}"
        assert data["status"] == "Resolved"
        assert data["text"] == "123 events in the last 10 minutes"
        assert (
            data["title_link"]
            == f"http://testserver/{incident.organization.slug}/{self.project.id}/issues/{metric_issue_context.group.id}/?referrer={referrer}&detection_type=static&notification_uuid={notification_uuid}"
        )
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

    def test_with_incident_trigger(self) -> None:
        alert_rule = self.create_alert_rule()
        now = self.now
        date_started = now - timedelta(minutes=5)
        event_date = now - timedelta(minutes=5)

        self.create_event(event_date)
        self.create_event(event_date)
        self.create_event(event_date)
        self.create_event(event_date)

        incident = self.create_incident(
            self.organization,
            title="Incident #2",
            projects=[self.project],
            alert_rule=alert_rule,
            status=IncidentStatus.CLOSED.value,
            date_started=date_started,
            query="",
        )
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )

        incident_trigger = IncidentTrigger.objects.get(incident=incident)
        incident_trigger.update(date_modified=now)

        # Test the trigger "firing"
        data = incident_attachment_info_with_metric_value(
            incident, IncidentStatus.CRITICAL, metric_value=4
        )
        assert data["title"] == "Critical: {}".format(
            alert_rule.name
        )  # Pulls from trigger, not incident
        assert data["status"] == "Critical"  # Should pull from the action/trigger.
        assert data["text"] == "4 events in the last 10 minutes"
        assert (
            data["title_link"]
            == f"http://testserver/organizations/baz/alerts/rules/details/{alert_rule.id}/?alert={incident.identifier}&referrer=metric_alert&detection_type=static"
        )
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

        # Test the trigger "resolving"
        data = incident_attachment_info_with_metric_value(
            incident, IncidentStatus.CLOSED, metric_value=4
        )
        assert data["title"] == f"Resolved: {alert_rule.name}"
        assert data["status"] == "Resolved"
        assert data["text"] == "4 events in the last 10 minutes"
        assert (
            data["title_link"]
            == f"http://testserver/organizations/baz/alerts/rules/details/{alert_rule.id}/?alert={incident.identifier}&referrer=metric_alert&detection_type=static"
        )
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

        # No trigger passed, uses incident as fallback
        data = incident_attachment_info_with_metric_value(
            incident, IncidentStatus.CLOSED, metric_value=4
        )
        assert data["title"] == f"Resolved: {alert_rule.name}"
        assert data["status"] == "Resolved"
        assert data["text"] == "4 events in the last 10 minutes"
        assert (
            data["title_link"]
            == f"http://testserver/organizations/baz/alerts/rules/details/{alert_rule.id}/?alert={incident.identifier}&referrer=metric_alert&detection_type=static"
        )
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

    def test_percent_change_alert(self) -> None:
        # 1 hour comparison_delta
        alert_rule = self.create_alert_rule(
            comparison_delta=60,
            detection_type=AlertRuleDetectionType.PERCENT,
            threshold_type=AlertRuleThresholdType.ABOVE,
        )
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
        metric_value = 123.12
        data = incident_attachment_info_with_metric_value(
            incident, IncidentStatus.CRITICAL, metric_value
        )
        assert (
            data["text"]
            == "Events 123% higher in the last 10 minutes compared to the same time one hour ago"
        )

    def test_percent_change_alert_rpc(self) -> None:
        # 1 hour comparison_delta
        alert_rule = self.create_alert_rule(
            comparison_delta=60,
            detection_type=AlertRuleDetectionType.PERCENT,
            threshold_type=AlertRuleThresholdType.ABOVE,
            dataset=Dataset.EventsAnalyticsPlatform,
            query_type=SnubaQuery.Type.PERFORMANCE,
        )
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
        metric_value = 123.12
        data = incident_attachment_info_with_metric_value(
            incident, IncidentStatus.CRITICAL, metric_value
        )
        assert (
            data["text"]
            == "Events 123% higher in the last 10 minutes compared to the same time one hour ago"
        )

    def test_percent_change_alert_custom_comparison_delta(self) -> None:
        alert_rule = self.create_alert_rule(
            # 1 month comparison_delta
            comparison_delta=720,
            threshold_type=AlertRuleThresholdType.ABOVE,
            detection_type=AlertRuleDetectionType.PERCENT,
        )
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
        metric_value = 123.12
        data = incident_attachment_info_with_metric_value(
            incident, IncidentStatus.CRITICAL, metric_value
        )
        assert (
            data["text"]
            == "Events 123% higher in the last 10 minutes compared to the same time 720 minutes ago"
        )


MOCK_NOW = timezone.now().replace(hour=13, minute=0, second=0, microsecond=0)


@freeze_time(MOCK_NOW)
class IncidentAttachmentInfoTestForCrashRateAlerts(TestCase, BaseMetricsTestCase):
    def setUp(self):
        super().setUp()
        self.now = timezone.now().replace(minute=0, second=0, microsecond=0)
        self._5_min_ago = (self.now - timedelta(minutes=5)).timestamp()
        self.date_started = self.now - timedelta(minutes=120)

    def create_incident_and_related_objects(self, field="sessions"):
        self.alert_rule = self.create_alert_rule(
            query="",
            aggregate=f"percentage({field}_crashed, {field}) AS _crash_rate_alert_aggregate",
            dataset=Dataset.Metrics,
            time_window=60,
        )
        self.incident = self.create_incident(
            self.organization,
            title="Incident #1",
            projects=[self.project],
            alert_rule=self.alert_rule,
            status=IncidentStatus.CLOSED.value,
            date_started=self.now - timedelta(minutes=120),
        )
        trigger = self.create_alert_rule_trigger(self.alert_rule, CRITICAL_TRIGGER_LABEL, 95)
        self.action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=self.incident
        )
        for _ in range(2):
            self.store_session(self.build_session(status="exited", started=self._5_min_ago))

    def create_daily_incident_and_related_objects(self, field="sessions"):
        self.daily_alert_rule = self.create_alert_rule(
            query="",
            aggregate=f"percentage({field}_crashed, {field}) AS _crash_rate_alert_aggregate",
            dataset=Dataset.Metrics,
            time_window=1440,
        )
        self.daily_incident = self.create_incident(
            self.organization,
            title="Incident #1",
            projects=[self.project],
            alert_rule=self.daily_alert_rule,
            status=IncidentStatus.CLOSED.value,
            date_started=self.now - timedelta(minutes=120),
        )
        trigger = self.create_alert_rule_trigger(self.daily_alert_rule, CRITICAL_TRIGGER_LABEL, 95)
        self.daily_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=self.daily_incident
        )
        for _ in range(2):
            self.store_session(self.build_session(status="exited", started=self._5_min_ago))

    def test_with_incident_trigger_sessions(self) -> None:
        self.create_incident_and_related_objects()
        data = incident_attachment_info_with_metric_value(
            self.incident, IncidentStatus.CRITICAL, 92
        )

        assert data["title"] == f"Critical: {self.alert_rule.name}"
        assert data["status"] == "Critical"
        assert data["text"] == "92% sessions crash free rate in the last hour"
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

    def test_with_incident_trigger_sessions_resolve(self) -> None:
        self.create_incident_and_related_objects()
        data = incident_attachment_info_with_metric_value(
            self.incident, IncidentStatus.CLOSED, metric_value=100.0
        )
        assert data["title"] == f"Resolved: {self.alert_rule.name}"
        assert data["status"] == "Resolved"
        assert data["text"] == "100.0% sessions crash free rate in the last hour"
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

    def test_with_incident_trigger_users(self) -> None:
        self.create_incident_and_related_objects(field="users")
        data = incident_attachment_info_with_metric_value(
            self.incident, IncidentStatus.CRITICAL, 92
        )
        assert data["title"] == f"Critical: {self.alert_rule.name}"
        assert data["status"] == "Critical"
        assert data["text"] == "92% users crash free rate in the last hour"
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

    def test_with_incident_trigger_users_resolve(self) -> None:
        self.create_incident_and_related_objects(field="users")
        data = incident_attachment_info_with_metric_value(
            self.incident, IncidentStatus.CLOSED, metric_value=100.0
        )
        assert data["title"] == f"Resolved: {self.alert_rule.name}"
        assert data["status"] == "Resolved"
        assert data["text"] == "100.0% users crash free rate in the last hour"
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

    def test_with_daily_incident_trigger_users_resolve(self) -> None:
        self.create_daily_incident_and_related_objects(field="users")
        data = incident_attachment_info_with_metric_value(
            self.daily_incident, IncidentStatus.CLOSED, metric_value=100.0
        )
        assert data["title"] == f"Resolved: {self.daily_alert_rule.name}"
        assert data["status"] == "Resolved"
        assert data["text"] == "100.0% users crash free rate in the last day"
        assert (
            data["logo_url"]
            == "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png"
        )

    def test_with_incident_where_no_sessions_exist(self) -> None:
        alert_rule = self.create_alert_rule(
            query="",
            aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            dataset=Dataset.Metrics,
            time_window=60,
        )
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 95)
        incident = self.create_incident(
            self.organization,
            title="Incident #2",
            projects=[self.project],
            alert_rule=alert_rule,
            status=IncidentStatus.CLOSED.value,
            date_started=self.now,
        )
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        data = incident_attachment_info_with_metric_value(incident, IncidentStatus.CRITICAL, 0)

        assert data["title"] == f"Critical: {alert_rule.name}"
        assert data["status"] == "Critical"
        assert data["text"] == "0% sessions crash free rate in the last hour"


@freeze_time(MOCK_NOW)
class IncidentAttachmentInfoTestForMetricsCrashRateAlerts(
    IncidentAttachmentInfoTestForCrashRateAlerts, BaseMetricsTestCase
):
    def create_incident_and_related_objects(self, field="sessions"):
        self.alert_rule = self.create_alert_rule(
            query="",
            aggregate=f"percentage({field}_crashed, {field}) AS _crash_rate_alert_aggregate",
            dataset=Dataset.Metrics,
            time_window=60,
        )
        self.incident = self.create_incident(
            self.organization,
            title="Incident #1",
            projects=[self.project],
            alert_rule=self.alert_rule,
            status=IncidentStatus.CLOSED.value,
            date_started=self.now - timedelta(minutes=120),
        )
        trigger = self.create_alert_rule_trigger(self.alert_rule, CRITICAL_TRIGGER_LABEL, 95)
        self.action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=self.incident
        )
        for _ in range(2):
            self.store_session(self.build_session(status="exited", started=self._5_min_ago))
