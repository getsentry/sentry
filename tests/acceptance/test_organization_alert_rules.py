from __future__ import absolute_import

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.models import Rule

FEATURE_NAME = ["organizations:incidents"]


class OrganizationAlertRulesListTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationAlertRulesListTest, self).setUp()
        self.login_as(self.user)
        self.path = u"/organizations/{}/alerts/rules/".format(self.organization.slug)

    def test_empty_alert_rules(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("alert rules - empty state")

    def test_alert_rules_list(self):
        Rule.objects.filter(project=self.project).update(date_added=timezone.now())
        self.create_alert_rule(
            name="My Alert Rule", date_added=timezone.now(), user=self.user,
        )

        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("alert rules - list")
