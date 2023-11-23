from datetime import timezone

from django.utils import timezone as django_timezone

from sentry.incidents.logic import update_incident_status
from sentry.incidents.models import IncidentStatus, IncidentStatusMethod
from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import no_silo_test

FEATURE_NAME = ["organizations:incidents", "organizations:performance-view"]

event_time = before_now(days=3).replace(tzinfo=timezone.utc)


@no_silo_test
class OrganizationIncidentsListTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.path = f"/organizations/{self.organization.slug}/alerts/"

    def test_empty_incidents(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def test_incidents_list(self):
        alert_rule = self.create_alert_rule(name="Alert Rule #1")
        incident = self.create_incident(
            self.organization,
            title="Incident #1",
            date_started=django_timezone.now(),
            date_detected=django_timezone.now(),
            projects=[self.project],
            alert_rule=alert_rule,
        )
        update_incident_status(
            incident, IncidentStatus.CRITICAL, status_method=IncidentStatusMethod.RULE_TRIGGERED
        )

        features = {feature: True for feature in FEATURE_NAME}
        with self.feature(features):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')

            details_url = f'[href="/organizations/{self.organization.slug}/alerts/rules/details/{alert_rule.id}/?alert={incident.id}'
            self.browser.wait_until(details_url)
            self.browser.click(details_url)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.wait_until_test_id("incident-rule-title")

            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
