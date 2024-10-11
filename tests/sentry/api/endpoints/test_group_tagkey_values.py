from datetime import timedelta
from unittest import mock

from django.utils import timezone

from sentry.testutils.cases import APITestCase, PerformanceIssueTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


class GroupTagKeyValuesTest(APITestCase, SnubaTestCase, PerformanceIssueTestCase):
    @mock.patch("sentry.analytics.record")
    def test_simple(self, mock_record):
        key, value = "foo", "bar"

        project = self.create_project()

        event = self.store_event(
            data={"tags": {key: value}, "timestamp": before_now(seconds=1).isoformat()},
            project_id=project.id,
        )
        group = event.group

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/tags/{key}/values/"

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]["value"] == "bar"

        mock_record.assert_called_with(
            "eventuser_endpoint.request",
            project_id=project.id,
            endpoint="sentry.api.endpoints.group_tagkey_values.get",
        )

    def test_simple_perf(self):
        key, value = "foo", "bar"
        event = self.create_performance_issue(
            tags=[[key, value]],
            fingerprint="group1",
            contexts={"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
        )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{event.group.id}/tags/{key}/values/"

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]["value"] == value

    def test_user_tag(self):
        project = self.create_project()
        project.date_added = timezone.now() - timedelta(minutes=10)
        project.save()
        event = self.store_event(
            data={
                "user": {
                    "id": 1,
                    "email": "foo@example.com",
                    "username": "foo",
                    "ip_address": "127.0.0.1",
                },
                "timestamp": before_now(seconds=10).isoformat(),
            },
            project_id=project.id,
        )
        group = event.group

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/tags/user/values/"

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]["email"] == "foo@example.com"
        assert response.data[0]["value"] == "id:1"

    def test_tag_value_with_backslash(self):
        project = self.create_project()
        project.date_added = timezone.now() - timedelta(minutes=10)
        project.save()
        event = self.store_event(
            data={
                "message": "minidumpC:\\Users\\test",
                "user": {
                    "id": 1,
                    "email": "foo@example.com",
                    "username": "foo",
                    "ip_address": "127.0.0.1",
                },
                "timestamp": before_now(seconds=5).isoformat(),
                "tags": {"message": "minidumpC:\\Users\\test"},
            },
            project_id=project.id,
        )
        group = event.group

        self.login_as(user=self.user)

        url = (
            f"/api/0/issues/{group.id}/tags/message/values/?query=minidumpC%3A%5C%5CUsers%5C%5Ctest"
        )

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]["value"] == "minidumpC:\\Users\\test"

    def test_count_sort(self):
        project = self.create_project()
        project.date_added = timezone.now() - timedelta(minutes=10)
        project.save()
        event = self.store_event(
            data={
                "message": "message 1",
                "platform": "python",
                "user": {
                    "id": 1,
                    "email": "foo@example.com",
                    "username": "foo",
                    "ip_address": "127.0.0.1",
                },
                "timestamp": before_now(seconds=10).isoformat(),
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "message": "message 1",
                "platform": "python",
                "user": {
                    "id": 1,
                    "email": "foo@example.com",
                    "username": "foo",
                    "ip_address": "127.0.0.1",
                },
                "timestamp": before_now(seconds=10).isoformat(),
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "message": "message 1",
                "platform": "python",
                "user": {
                    "id": 2,
                    "email": "bar@example.com",
                    "username": "bar",
                    "ip_address": "127.0.0.1",
                },
                "timestamp": before_now(seconds=10).isoformat(),
            },
            project_id=project.id,
        )
        group = event.group

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/tags/user/values/?sort=count"

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 2

        assert response.data[0]["email"] == "foo@example.com"
        assert response.data[0]["value"] == "id:1"

        assert response.data[1]["email"] == "bar@example.com"
        assert response.data[1]["value"] == "id:2"
