from __future__ import absolute_import

from django.utils import timezone
import pytz

from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.incidents.logic import create_alert_rule, create_incident
from sentry.incidents.models import IncidentType
from sentry.snuba.models import QueryAggregations

FEATURE_NAME = "organizations:incidents"

event_time = before_now(days=3).replace(tzinfo=pytz.utc)


class OrganizationIncidentsListTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationIncidentsListTest, self).setUp()
        self.login_as(self.user)
        self.path = u"/organizations/{}/incidents/".format(self.organization.slug)

    def test_empty_incidents(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading-indicator")
            self.browser.snapshot("incidents - empty state")

    def test_incidents_list(self):
        alert_rule = create_alert_rule(
            self.organization,
            [self.project],
            "hello",
            "level:error",
            QueryAggregations.TOTAL,
            10,
            1,
        )

        incident = create_incident(
            self.organization,
            type=IncidentType.DETECTED,
            title="Incident #1",
            query="hello",
            aggregation=QueryAggregations.TOTAL,
            date_started=timezone.now(),
            date_detected=timezone.now(),
            projects=[self.project],
            groups=[self.group],
            alert_rule=alert_rule,
        )

        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not(".loading-indicator")
            self.browser.wait_until_test_id("incident-sparkline")
            self.browser.snapshot("incidents - list")

            details_url = u'[href="/organizations/{}/incidents/{}/'.format(
                self.organization.slug, incident.identifier
            )
            self.browser.wait_until(details_url)
            self.browser.click(details_url)
            self.browser.wait_until_not(".loading-indicator")
            self.browser.wait_until_test_id("incident-title")

            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
            self.browser.snapshot("incidents - details")
