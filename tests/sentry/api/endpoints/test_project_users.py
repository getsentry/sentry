from datetime import timedelta
from unittest import mock

from django.utils import timezone

from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.utils.eventuser import EventUser


class EventUserProjectUsersTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-project-users"
    method = "get"

    def setUp(self):
        super().setUp()
        self.project = self.create_project(
            organization=self.organization, date_added=(timezone.now() - timedelta(hours=2))
        )

        timestamp = (timezone.now() - timedelta(hours=1)).isoformat()
        self.event1 = self.store_event(
            project_id=self.project.id,
            data={
                "user": {
                    "id": 1,
                    "email": "foo@example.com",
                    "username": "foobar",
                    "ip_address": "127.0.0.1",
                },
                "event_id": "b" * 32,
                "timestamp": timestamp,
            },
        )
        self.euser1 = EventUser.from_event(self.event1)
        self.event2 = self.store_event(
            project_id=self.project.id,
            data={
                "user": {
                    "id": 2,
                    "email": "bar@example.com",
                    "username": "baz",
                    "ip_address": "192.168.0.1",
                },
                "event_id": "c" * 32,
                "timestamp": timestamp,
            },
        )
        self.euser2 = EventUser.from_event(self.event2)

    def _assert_simple_response(self, response, mock_record):
        assert len(response.data) == 2
        if self.euser1.id is None and self.euser2.id is None:
            assert list(map(lambda x: x["id"], response.data)) == [None, None]
        else:
            assert sorted(map(lambda x: x["id"], response.data)) == sorted(
                [str(self.euser1.id), str(self.euser2.id)]
            )
        mock_record.assert_any_call(
            "eventuser_endpoint.request",
            project_id=self.project.id,
            endpoint="sentry.api.endpoints.project_users.get",
        )

    @mock.patch("sentry.analytics.record")
    def test_simple(self, mock_record):
        self.login_as(user=self.user)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, status_code=200
        )

        self._assert_simple_response(response, mock_record)

    @mock.patch("sentry.analytics.record")
    def test_superuser_simple(self, mock_record):
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, status_code=200
        )
        self._assert_simple_response(response, mock_record)

    @mock.patch("sentry.analytics.record")
    def test_staff_simple(self, mock_record):
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, status_code=200
        )

        self._assert_simple_response(response, mock_record)

    def test_empty_search_query(self):
        self.login_as(user=self.user)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, query="foo", status_code=200
        )

        assert len(response.data) == 0

    def test_username_search(self):
        self.login_as(user=self.user)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, query="username:baz", status_code=200
        )

        assert len(response.data) == 1
        if self.euser2.id is None:
            assert response.data[0]["id"] is None
        else:
            assert response.data[0]["id"] == str(self.euser2.id)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, query="username:ba", status_code=200
        )

        assert len(response.data) == 0

    def test_email_search(self):
        self.login_as(user=self.user)

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            query="email:foo@example.com",
            status_code=200,
        )

        assert len(response.data) == 1
        if self.euser1.id is None:
            assert response.data[0]["id"] is None
        else:
            assert response.data[0]["id"] == str(self.euser1.id)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, query="email:@example.com", status_code=200
        )

        assert len(response.data) == 0

    def test_id_search(self):
        self.login_as(user=self.user)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, query="id:1", status_code=200
        )

        assert len(response.data) == 1
        if self.euser1.id is None:
            assert response.data[0]["id"] is None
        else:
            assert response.data[0]["id"] == str(self.euser1.id)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, query="id:3", status_code=200
        )

        assert len(response.data) == 0

    def test_ip_search(self):
        self.login_as(user=self.user)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, query="ip:192.168.0.1", status_code=200
        )

        assert len(response.data) == 1
        if self.euser2.id is None:
            assert response.data[0]["id"] is None
        else:
            assert response.data[0]["id"] == str(self.euser2.id)
