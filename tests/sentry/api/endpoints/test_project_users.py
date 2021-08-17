from django.urls import reverse

from sentry.models import EventUser
from sentry.testutils import APITestCase


class ProjectUsersTest(APITestCase):
    def setUp(self):
        super().setUp()

        self.project = self.create_project()
        self.euser1 = EventUser.objects.create(
            project_id=self.project.id,
            ident="1",
            email="foo@example.com",
            username="foobar",
            ip_address="127.0.0.1",
        )

        self.euser2 = EventUser.objects.create(
            project_id=self.project.id,
            ident="2",
            email="bar@example.com",
            username="baz",
            ip_address="192.168.0.1",
        )

        self.path = reverse(
            "sentry-api-0-project-users",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

    def test_simple(self):
        self.login_as(user=self.user)

        response = self.client.get(self.path, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x["id"], response.data)) == sorted(
            [str(self.euser1.id), str(self.euser2.id)]
        )

    def test_empty_search_query(self):
        self.login_as(user=self.user)

        response = self.client.get(f"{self.path}?query=foo", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_username_search(self):
        self.login_as(user=self.user)

        response = self.client.get(f"{self.path}?query=username:baz", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.euser2.id)

        response = self.client.get(f"{self.path}?query=username:ba", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_email_search(self):
        self.login_as(user=self.user)

        response = self.client.get(f"{self.path}?query=email:foo@example.com", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.euser1.id)

        response = self.client.get(f"{self.path}?query=email:@example.com", format="json")

        assert response.status_code == 404, response.content

    def test_id_search(self):
        self.login_as(user=self.user)

        response = self.client.get(f"{self.path}?query=id:1", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.euser1.id)

        response = self.client.get(f"{self.path}?query=id:3", format="json")

        assert response.status_code == 404, response.content

    def test_ip_search(self):
        self.login_as(user=self.user)

        response = self.client.get(f"{self.path}?query=ip:192.168.0.1", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.euser2.id)
