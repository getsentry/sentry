from django.utils import timezone

from sentry.incidents.models import AlertRuleThresholdType, IncidentTrigger, TriggerStatus
from sentry.models import Rule
from sentry.testutils import AcceptanceTestCase, SnubaTestCase

FEATURE_NAME = ["organizations:incidents"]


class OrganizationAlertRulesListTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.org = self.create_organization()
        self.path = f"/organizations/{self.organization.slug}/alerts/rules/"

    def test_empty_alert_rules(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("alert rules - empty state")

    def test_alert_rules_list(self):
        Rule.objects.filter(project=self.project).update(date_added=timezone.now())
        self.create_alert_rule(
            name="My Alert Rule",
            date_added=timezone.now(),
            user=self.user,
        )

        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("alert rules - list")

    def test_alert_rules_incidents(self):
        alert_rule_critical = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            name="some rule [crit]",
            query="",
            aggregate="count()",
            time_window=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            resolve_threshold=10,
            threshold_period=1,
        )
        trigger = self.create_alert_rule_trigger(alert_rule_critical, "hi", 100)

        self.create_incident(status=2, alert_rule=alert_rule_critical)
        crit_incident = self.create_incident(status=20, alert_rule=alert_rule_critical)
        IncidentTrigger.objects.create(
            incident=crit_incident, alert_rule_trigger=trigger, status=TriggerStatus.RESOLVED.value
        )

        with self.feature(["organizations:incidents", "organizations:alert-list"]):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("alert rules - alert list")
