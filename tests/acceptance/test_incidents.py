from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.logic import update_incident_status
from sentry.incidents.models.incident import IncidentStatus, IncidentStatusMethod
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.silo import no_silo_test
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.migration_helpers.alert_rule import migrate_alert_rule
from sentry.workflow_engine.models import IncidentGroupOpenPeriod

FEATURE_NAME = ["organizations:incidents", "organizations:performance-view"]


@no_silo_test
class OrganizationIncidentsListTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.path = f"/organizations/{self.organization.slug}/issues/alerts/"

    def test_incidents_list(self) -> None:
        alert_rule = self.create_alert_rule(name="Alert Rule #1")
        _, _, _, detector, _, _, _, _ = migrate_alert_rule(alert_rule)

        group = self.create_group(type=MetricIssue.type_id, project=self.project)
        group.update(priority=PriorityLevel.HIGH.value)
        self.create_detector_group(detector=detector, group=group)
        gop = GroupOpenPeriod.objects.get(group=group, project=self.project)

        incident = self.create_incident(
            self.organization,
            title="Incident #1",
            date_started=timezone.now(),
            date_detected=timezone.now(),
            projects=[self.project],
            alert_rule=alert_rule,
        )
        IncidentGroupOpenPeriod.objects.create(
            group_open_period=gop,
            incident_id=incident.id,
            incident_identifier=incident.identifier,
        )
        update_incident_status(
            incident, IncidentStatus.CRITICAL, status_method=IncidentStatusMethod.RULE_TRIGGERED
        )

        features = {feature: True for feature in FEATURE_NAME}
        with self.feature(features):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')

            details_url = f'[href="/organizations/{self.organization.slug}/issues/alerts/rules/details/{alert_rule.id}/?alert={incident.id}'
            self.browser.wait_until(details_url)
            self.browser.click(details_url)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.wait_until_test_id("incident-rule-title")

            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
