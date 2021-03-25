from sentry.models import EventUser
from sentry.testutils import APITestCase


class ProjectUserDetailsTest(APITestCase):
    endpoint = "sentry-api-0-project-user-details"

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.org = self.create_organization(owner=None)
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(organization=self.org, teams=[self.team])
        self.create_member(
            user=self.user, organization=self.org, teams=[self.project.teams.first()]
        )
        self.euser = EventUser.objects.create(email="foo@example.com", project_id=self.project.id)

        self.login_as(user=self.user)

    def test_simple(self):
        response = self.get_valid_response(self.org.slug, self.project.slug, self.euser.hash)
        assert response.data["id"] == str(self.euser.id)
