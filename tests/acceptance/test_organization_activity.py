from django.utils import timezone

from sentry.models.activity import Activity
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test
from sentry.types.activity import ActivityType


@no_silo_test
class OrganizationActivityTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.group = self.create_group(project=self.project)
        self.login_as(self.user)
        self.path = f"/organizations/{self.org.slug}/activity/"
        self.project.update(first_event=timezone.now())

    def test(self):
        Activity.objects.create(
            group=self.group,
            project=self.group.project,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "hello world"},
        )

        self.browser.get(self.path)
        self.browser.wait_until_not(".loading-indicator", timeout=100000)
        self.browser.wait_until('[data-test-id="activity-feed-list"]')

    def test_empty(self):
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
