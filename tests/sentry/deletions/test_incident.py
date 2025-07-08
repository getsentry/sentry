from django.utils import timezone

from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.models.incident import Incident, IncidentProject
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.workflow_engine.models import IncidentGroupOpenPeriod
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class DeleteIncidentTest(BaseWorkflowTest, HybridCloudTestMixin):
    def test_simple(self):
        organization = self.create_organization()
        alert_rule = self.create_alert_rule(organization=organization)
        self.create_alert_rule_trigger(alert_rule=alert_rule)
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
        group_open_period = GroupOpenPeriod.objects.create(
            project=self.project, group=group, user_id=self.user.id
        )
        IncidentGroupOpenPeriod.objects.create(
            incident_id=incident.id,
            incident_identifier=incident.identifier,
            group_open_period=group_open_period,
        )

        self.ScheduledDeletion.schedule(instance=incident, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Incident.objects.filter(id=incident.id).exists()
        assert not IncidentGroupOpenPeriod.objects.filter(
            incident_id=incident.id,
            incident_identifier=incident.identifier,
            group_open_period=group_open_period,
        ).exists()
        assert not IncidentProject.objects.filter(incident=incident, project=self.project).exists()
        assert not GroupOpenPeriod.objects.filter(
            project=self.project, group=group, user_id=self.user.id
        )
