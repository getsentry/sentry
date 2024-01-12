from django.utils import timezone

from sentry.incidents.models import IncidentStatus
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test

FEATURE_NAME = ["organizations:incidents"]


@no_silo_test
class ProjectDetailTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)

        self.team1 = self.create_team(organization=self.org, name="Mariachi Band 1")
        self.team2 = self.create_team(organization=self.org, name="Mariachi Band 2")
        self.team3 = self.create_team(organization=self.org, name="Mariachi Band 3")
        self.team4 = self.create_team(organization=self.org, name="Mariachi Band 4")
        self.team5 = self.create_team(organization=self.org, name="Mariachi Band 5")
        self.team6 = self.create_team(organization=self.org, name="Mariachi Band 6")

        self.project = self.create_project(
            organization=self.org,
            teams=[self.team1, self.team2, self.team3, self.team4, self.team5, self.team6],
            name="Bengal",
        )
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team1])

        alert_rule = self.create_alert_rule(organization=self.org, projects=[self.project])
        self.create_incident(
            organization=self.org,
            title="Incident #1",
            date_started=timezone.now(),
            date_detected=timezone.now(),
            projects=[self.project],
            alert_rule=alert_rule,
            status=IncidentStatus.WARNING.value,
        )
        self.create_incident(
            organization=self.org,
            title="Incident #2",
            date_started=timezone.now(),
            date_detected=timezone.now(),
            projects=[self.project],
            alert_rule=alert_rule,
            status=IncidentStatus.CRITICAL.value,
        )
        self.create_incident(
            organization=self.org,
            title="Incident #3",
            date_started=timezone.now(),
            date_detected=timezone.now(),
            date_closed=timezone.now(),
            projects=[self.project],
            alert_rule=alert_rule,
            status=IncidentStatus.CLOSED.value,
        )

        self.create_release(project=self.project, version="1.0.0")
        self.create_release(project=self.project, version="1.1.0")
        self.create_release(project=self.project, version="1.2.3")
        self.create_release(project=self.project, version="2.0.5")
        self.create_release(project=self.project, version="2.3.3")
        self.create_release(project=self.project, version="3.3.3")

        self.login_as(self.user)
        self.path = f"/organizations/{self.org.slug}/projects/{self.project.slug}/"

    def test_simple(self):
        with self.feature(FEATURE_NAME):
            self.browser.get(self.path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            self.browser.wait_until_not('[data-test-id="loading-placeholder"]')

    def test_no_feature(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
