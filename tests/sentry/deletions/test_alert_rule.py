from sentry.incidents.models import AlertRule, AlertRuleTrigger
from sentry.models.organization import Organization
from sentry.tasks.deletion.scheduled import run_scheduled_deletions
from sentry.testutils.cases import TestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.silo import region_silo_test


@region_silo_test
class DeleteAlertRuleTest(TestCase, HybridCloudTestMixin):
    def test_simple(self):
        organization = self.create_organization()
        alert_rule = self.create_alert_rule(organization=organization)
        alert_rule_trigger = self.create_alert_rule_trigger(alert_rule=alert_rule)

        self.ScheduledDeletion.schedule(instance=alert_rule, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert Organization.objects.filter(id=organization.id).exists()
        assert not AlertRule.objects.filter(id=alert_rule.id).exists()
        assert not AlertRuleTrigger.objects.filter(id=alert_rule_trigger.id).exists()
