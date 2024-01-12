from django.utils import timezone

from sentry.incidents.models import AlertRuleThresholdType, IncidentTrigger, TriggerStatus
from sentry.models.rule import Rule
from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.silo import no_silo_test

FEATURE_NAME = ["organizations:incidents"]


@no_silo_test
class OrganizationAlertRulesListTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.path = f"/organizations/{self.organization.slug}/alerts/rules/"

    def test_empty_alert_rules(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def test_alert_rules_list(self):
        Rule.objects.filter(project=self.project).update(date_added=timezone.now())
        self.create_alert_rule(
            name="My Alert Rule",
            date_added=timezone.now(),
            user=self.user,
        )

        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def test_alert_rules_alert_list(self):
        self.create_alert_rule(
            name="My Alert Rule",
            projects=[self.project],
            date_added=timezone.now(),
            user=self.user,
        )
        alert_rule_critical = self.create_alert_rule(
            organization=self.organization,
            projects=[self.project],
            name="some rule [crit]",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
        )
        trigger = self.create_alert_rule_trigger(
            alert_rule=alert_rule_critical, alert_threshold=100
        )
        crit_incident = self.create_incident(status=20, alert_rule=alert_rule_critical)
        IncidentTrigger.objects.create(
            incident=crit_incident, alert_rule_trigger=trigger, status=TriggerStatus.ACTIVE.value
        )

        with self.feature(["organizations:incidents"]):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
