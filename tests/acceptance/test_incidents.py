from __future__ import absolute_import

from django.utils import timezone
import pytz
from mock import patch

from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.incidents.logic import create_incident
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
        incident = create_incident(
            self.organization,
            type=IncidentType.CREATED,
            title="Incident #1",
            query="",
            aggregation=QueryAggregations.TOTAL,
            date_started=timezone.now(),
            projects=[self.project],
            groups=[self.group],
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

    @patch("django.utils.timezone.now")
    def test_open_create_incident_modal(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": iso_format(event_time),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        with self.feature(FEATURE_NAME):
            self.browser.get(u"/organizations/{}/issues/".format(self.organization.slug))
            self.browser.wait_until_not(".loading-indicator")
            self.browser.wait_until_test_id("group")
            self.browser.click('[data-test-id="group"]')
            self.browser.click('[data-test-id="action-link-create-new-incident"]')
            self.browser.wait_until_test_id("create-new-incident-form")
            # TODO: Figure out how to deal with mocked dates
