from unittest.mock import MagicMock, patch

import orjson
from django.utils import timezone
from urllib3 import HTTPResponse

from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleTrigger,
)
from sentry.incidents.models.incident import Incident, IncidentProject
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.organization import Organization
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.workflow_engine.models import (
    AlertRuleDetector,
    AlertRuleWorkflow,
    IncidentGroupOpenPeriod,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class DeleteAlertRuleTest(BaseWorkflowTest, HybridCloudTestMixin):
    def test_simple(self) -> None:
        organization = self.create_organization()
        alert_rule = self.create_alert_rule(organization=organization)
        alert_rule_trigger = self.create_alert_rule_trigger(alert_rule=alert_rule)
        incident = self.create_incident(
            organization,
            title="Incident #1",
            date_started=timezone.now(),
            date_detected=timezone.now(),
            projects=[self.project],
            alert_rule=alert_rule,
        )
        one_minute = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={"timestamp": one_minute, "fingerprint": ["group1"]}, project_id=self.project.id
        )
        group = event.group
        assert group
        group_open_period = GroupOpenPeriod.objects.get(project=self.project, group=group)
        IncidentGroupOpenPeriod.objects.create(
            incident_id=incident.id,
            incident_identifier=incident.identifier,
            group_open_period=group_open_period,
        )

        detector = self.create_detector()
        workflow = self.create_workflow()
        AlertRuleDetector.objects.create(alert_rule_id=alert_rule.id, detector=detector)
        AlertRuleWorkflow.objects.create(alert_rule_id=alert_rule.id, workflow=workflow)

        self.ScheduledDeletion.schedule(instance=alert_rule, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert Organization.objects.filter(id=organization.id).exists()
        assert not AlertRule.objects.filter(id=alert_rule.id).exists()
        assert not AlertRuleTrigger.objects.filter(id=alert_rule_trigger.id).exists()
        assert not Incident.objects.filter(id=incident.id).exists()
        assert not IncidentProject.objects.filter(incident=incident, project=self.project).exists()
        assert not IncidentGroupOpenPeriod.objects.filter(
            incident_id=incident.id,
            incident_identifier=incident.identifier,
            group_open_period=group_open_period,
        ).exists()
        assert not GroupOpenPeriod.objects.filter(project=self.project, group=group)
        assert not AlertRuleDetector.objects.filter(alert_rule_id=alert_rule.id).exists()
        assert not AlertRuleWorkflow.objects.filter(alert_rule_id=alert_rule.id).exists()

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_dynamic_alert_rule(self, mock_store_request: MagicMock) -> None:
        organization = self.create_organization()

        seer_return_value = {"success": True}
        mock_store_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        alert_rule = self.create_alert_rule(
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            time_window=60,
            detection_type=AlertRuleDetectionType.DYNAMIC,
            organization=organization,
        )
        alert_rule_trigger = self.create_alert_rule_trigger(
            alert_rule=alert_rule, alert_threshold=0
        )
        incident = self.create_incident(
            organization,
            title="Incident #1",
            date_started=timezone.now(),
            date_detected=timezone.now(),
            projects=[self.project],
            alert_rule=alert_rule,
        )

        self.ScheduledDeletion.schedule(instance=alert_rule, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert Organization.objects.filter(id=organization.id).exists()
        assert not AlertRule.objects.filter(id=alert_rule.id).exists()
        assert not AlertRuleTrigger.objects.filter(id=alert_rule_trigger.id).exists()
        assert not Incident.objects.filter(id=incident.id).exists()
