from datetime import timedelta
from unittest import mock

from django.urls import reverse
from django.utils import timezone

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import iso_format
from sentry.testutils.silo import region_silo_test

# from sentry.models.eventuser import EventUser
from sentry.utils.eventuser import EventUser


@region_silo_test(stable=True)
class ProjectUsersTest(APITestCase):
    def setUp(self):
        super().setUp()

        self.project = self.create_project()
        self.euser1 = EventUser(
            project_id=self.project.id,
            email="foo@example.com",
            username="foobar",
            name="Foo Bar",
            ip_address="127.0.0.1",
            id=1,
        )

        self.euser2 = EventUser(
            project_id=self.project.id,
            email="bar@example.com",
            username="baz",
            name="Baz",
            ip_address="192.168.0.1",
            id=2,
        )

        self.path = reverse(
            "sentry-api-0-project-users",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

        self.event1 = self.store_event(
            project_id=self.project.id,
            data={
                "user": {
                    "id": self.euser1.id,
                    "email": self.euser1.email,
                    "username": self.euser1.username,
                    "ip_address": self.euser1.ip_address,
                },
                "event_id": "b" * 32,
                "timestamp": iso_format(timezone.now() - timedelta(days=1)),
            },
        )

        self.event2 = self.store_event(
            project_id=self.project.id,
            data={
                "user": {
                    "id": self.euser2.id,
                    "email": self.euser2.email,
                    "username": self.euser2.username,
                    "ip_address": self.euser2.ip_address,
                },
                "event_id": "c" * 32,
                "timestamp": iso_format(timezone.now() - timedelta(days=1)),
            },
        )

    @mock.patch("sentry.analytics.record")
    def test_simple(self, mock_record):
        self.login_as(user=self.user)

        response = self.client.get(self.path, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x["id"], response.data)) == sorted(
            [str(self.euser1.id), str(self.euser2.id)]
        )
        mock_record.assert_called_with(
            "eventuser_endpoint.request",
            project_id=self.project.id,
            endpoint="sentry.api.endpoints.project_users.get",
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

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_id_search(self):
        self.login_as(user=self.user)

        response = self.client.get(f"{self.path}?query=id:1", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.euser1.id)

        response = self.client.get(f"{self.path}?query=id:3", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_ip_search(self):
        self.login_as(user=self.user)

        response = self.client.get(f"{self.path}?query=ip:192.168.0.1", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.euser2.id)
