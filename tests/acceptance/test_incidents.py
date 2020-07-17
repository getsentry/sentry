from __future__ import absolute_import

from django.utils import timezone
import pytz

from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now

FEATURE_NAME = ["organizations:incidents", "organizations:performance-view"]

event_time = before_now(days=3).replace(tzinfo=pytz.utc)


class OrganizationIncidentsListTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationIncidentsListTest, self).setUp()
        self.login_as(self.user)
        self.path = u"/organizations/{}/alerts/".format(self.organization.slug)

    def test_empty_incidents(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("incidents - empty state")

    def test_incidents_list(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(
            self.organization,
            title="Incident #1",
            date_started=timezone.now(),
            date_detected=timezone.now(),
            projects=[self.project],
            alert_rule=alert_rule,
        )

        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading-indicator")
            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
            self.browser.wait_until_test_id("incident-sparkline")
            self.browser.snapshot("incidents - list")

            details_url = u'[href="/organizations/{}/alerts/{}/'.format(
                self.organization.slug, incident.identifier
            )
            self.browser.wait_until(details_url)
            self.browser.click(details_url)
            self.browser.wait_until_not(".loading-indicator")
            self.browser.wait_until_test_id("incident-title")

            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
            self.browser.blur()
            self.browser.snapshot("incidents - details")
