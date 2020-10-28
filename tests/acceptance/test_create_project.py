from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase
from sentry.models import Project
from sentry.utils.compat.mock import patch


class CreateProjectTest(AcceptanceTestCase):
    def setUp(self):
        super(CreateProjectTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger")
        self.login_as(self.user)

        self.path = u"/organizations/{}/projects/new/".format(self.org.slug)

    @patch("django.db.models.signals.ModelSignal.send")
    def test_simple(self, mock_signal):
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])

        self.browser.get(self.path)
        self.browser.wait_until_not(".loading")

        self.browser.click('[data-test-id="platform-java"]')
        self.browser.snapshot(name="create project")

        self.browser.click('[data-test-id="create-project"]')
        self.browser.wait_until_not(".loading")
        self.browser.wait_until("#installation")

        project = Project.objects.get(organization=self.org)
        assert project.name == "Java"
        assert project.platform == "java"
        assert project.teams.first() == self.team
        self.browser.snapshot(name="docs redirect")

    def test_no_teams(self):
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[])
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading")

        self.browser.click('[data-test-id="create-team"]')
        self.browser.wait_until(".modal-dialog")
        input = self.browser.element('input[name="slug"]')
        input.send_keys("new-team")

        self.browser.element(".modal-dialog form").submit()

        # After creating team, should end up in onboarding screen
        self.browser.wait_until(xpath='//span[text()="#new-team"]')
        self.browser.snapshot(name="create project no teams - after create team")

    def test_many_teams(self):
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.team2 = self.create_team(organization=self.org, name="team two")
        self.create_member(
            user=self.user, organization=self.org, role="owner", teams=[self.team, self.team2]
        )
        self.browser.get(self.path)
        self.browser.wait_until_not(".loading")
        self.browser.snapshot(name="create project many teams")
