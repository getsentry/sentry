from unittest.mock import patch

from sentry.incidents.models.alert_rule import AlertRule, AlertRuleStatus
from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.tasks import auto_resolve_snapshot_incidents
from sentry.testutils.cases import TestCase


class AutoResolveSnapshotIncidentsTest(TestCase):
    def test_resolves_open_incidents(self):
        alert_rule = self.create_alert_rule()
        AlertRule.objects.filter(id=alert_rule.id).update(status=AlertRuleStatus.SNAPSHOT.value)
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.OPEN.value)

        auto_resolve_snapshot_incidents(alert_rule_id=alert_rule.id)

        incident.refresh_from_db()
        assert incident.status == IncidentStatus.CLOSED.value

    @patch("sentry.incidents.tasks.auto_resolve_snapshot_incidents.apply_async")
    def test_reenqueues_when_more_than_batch_size(self, mock_apply_async):
        alert_rule = self.create_alert_rule()
        AlertRule.objects.filter(id=alert_rule.id).update(status=AlertRuleStatus.SNAPSHOT.value)
        for _ in range(55):
            self.create_incident(alert_rule=alert_rule, status=IncidentStatus.OPEN.value)

        auto_resolve_snapshot_incidents(alert_rule_id=alert_rule.id)

        mock_apply_async.assert_called_once_with(kwargs={"alert_rule_id": alert_rule.id})
