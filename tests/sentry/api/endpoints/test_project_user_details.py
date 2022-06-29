from sentry.models import EventUser
from sentry.testutils import APITestCase


class ProjectUserDetailsTest(APITestCase):
    endpoint = "sentry-api-0-project-user-details"

    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=None)
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(organization=self.org, teams=[self.team])
        self.create_member(
            user=self.user, organization=self.org, teams=[self.project.teams.first()]
        )
        self.euser = EventUser.objects.create(email="foo@example.com", project_id=self.project.id)
        self.euser2 = EventUser.objects.create(email="bar@example.com", project_id=self.project.id)

    def test_simple(self):
        self.login_as(user=self.user)
        response = self.get_success_response(self.org.slug, self.project.slug, self.euser.hash)
        assert response.data["id"] == str(self.euser.id)

    def test_delete_event_user(self):
        # Only delete an event user as a superuser
        self.login_as(user=self.user, superuser="true")

        assert EventUser.objects.count() == 2

        path = f"/api/0/projects/{self.org.slug}/{self.project.slug}/users/{self.euser.hash}/"
        response = self.client.delete(path)

        assert response.status_code == 200
        assert EventUser.objects.count() == 1

        # User doesn't exist
        path = f"/api/0/projects/{self.org.slug}/{self.project.slug}/users/1234567abcdefg"
        response = self.client.delete(path)

        assert response.status_code == 404
        assert EventUser.objects.count() == 1

        # Not a superuser
        self.login_as(user=self.create_user(is_superuser=False))

        assert EventUser.objects.count() == 1

        path = f"/api/0/projects/{self.org.slug}/{self.project.slug}/users/{self.euser2.hash}/"
        response = self.client.delete(path)

        assert response.status_code == 403
        assert EventUser.objects.count() == 1
