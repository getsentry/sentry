from datetime import datetime, timezone

from sentry.models.projectkey import ProjectKey
from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class ProjectKeysTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])

        ProjectKey.objects.filter(project=self.project).delete()
        ProjectKey.objects.create(
            project=self.project,
            label="Default",
            public_key="5cc0482a13d248ff99f9717101dd6356",
            secret_key="410fd998318844b8894775f36184ec28",
        )

        self.login_as(self.user)
        self.path = f"/{self.org.slug}/{self.project.slug}/settings/keys/"

    def test_simple(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until_test_id("project-keys")


@no_silo_test
class ProjectKeyDetailsTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])

        self.pk = ProjectKey.objects.create(
            project=self.project,
            label="Default",
            public_key="5cc0482a13d248ff99f9717101dd6356",
            secret_key="410fd998318844b8894775f36184ec28",
            date_added=datetime(2015, 10, 1, 21, 19, 5, 648517, tzinfo=timezone.utc),
        )

        self.login_as(self.user)
        self.path = f"/{self.org.slug}/{self.project.slug}/settings/keys/{self.pk.public_key}/"

    def test_simple(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until_test_id("key-details")
        self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
