from __future__ import absolute_import

import pytz

from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now

FEATURE_NAME = ["organizations:incidents"]

event_time = before_now(days=3).replace(tzinfo=pytz.utc)


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
        self.create_alert_rule(name="My Alert Rule")

        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("alert rules - list")
