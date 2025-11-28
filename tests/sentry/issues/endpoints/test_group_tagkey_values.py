import datetime
from datetime import timedelta
from unittest import mock

from django.test import override_settings
from django.utils import timezone

from sentry import tagstore
from sentry.analytics.events.eventuser_endpoint_request import EventUserEndpointRequest
from sentry.testutils.cases import APITestCase, PerformanceIssueTestCase, SnubaTestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.helpers.datetime import before_now, freeze_time


class GroupTagKeyValuesTest(APITestCase, SnubaTestCase, PerformanceIssueTestCase):
    @mock.patch("sentry.analytics.record")
    def test_simple(self, mock_record: mock.MagicMock) -> None:
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

        assert_last_analytics_event(
            mock_record,
            EventUserEndpointRequest(
                project_id=project.id,
                endpoint="sentry.api.endpoints.group_tagkey_values.get",
            ),
        )

    def test_simple_perf(self) -> None:
        key, value = "foo", "bar"
        event = self.create_performance_issue(
            tags=[[key, value]],
            fingerprint="group1",
            contexts={"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
        )
        assert event.group is not None

        self.login_as(user=self.user)

        url = f"/api/0/issues/{event.group.id}/tags/{key}/values/"

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]["value"] == value

    def test_user_tag(self) -> None:
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

    def test_tag_value_with_backslash(self) -> None:
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

    def test_includes_empty_values_by_default(self) -> None:
        project = self.create_project()

        self.store_event(
            data={
                "tags": {"foo": ""},
                "timestamp": before_now(seconds=1).isoformat(),
            },
            project_id=project.id,
            assert_no_errors=False,
        )
        event = self.store_event(
            data={
                "tags": {"foo": "bar"},
                "timestamp": before_now(seconds=1).isoformat(),
            },
            project_id=project.id,
        )
        group = event.group

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/tags/foo/values/"

        response = self.client.get(url)

        assert response.status_code == 200
        values = {item["value"] for item in response.data}
        assert values == {"", "bar"}
        counts = {item["value"]: item["count"] for item in response.data}
        assert counts.get("") == 1
        assert counts.get("bar") == 1

    def test_includes_empty_values_backend_helpers(self) -> None:
        project = self.create_project()

        self.store_event(
            data={
                "tags": {"foo": ""},
                "timestamp": before_now(seconds=1).isoformat(),
            },
            project_id=project.id,
            assert_no_errors=False,
        )
        event = self.store_event(
            data={
                "tags": {"foo": "bar"},
                "timestamp": before_now(seconds=1).isoformat(),
            },
            project_id=project.id,
        )

        group = event.group

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/tags/foo/values/"

        group_tag_key = tagstore.backend.get_group_tag_key(
            group,
            None,
            "foo",
            tenant_ids={"organization_id": group.project.organization_id},
        )
        top_values = {tv.value for tv in group_tag_key.top_values}
        assert top_values == {"", "bar"}

        iter_values = tagstore.backend.get_group_tag_value_iter(
            group,
            [],
            "foo",
            tenant_ids={"organization_id": group.project.organization_id},
        )
        assert {tv.value for tv in iter_values} == {"", "bar"}

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 2

        values = {item["value"]: item["count"] for item in response.data}
        assert values.get("bar") == 1
        assert values.get("") == 1

    def test_user_tag_with_empty_values(self) -> None:
        """Test that user tags with empty values don't cause AttributeError."""
        project = self.create_project()

        # Event with user data
        self.store_event(
            data={
                "user": {"id": "user123"},
                "timestamp": before_now(seconds=1).isoformat(),
            },
            project_id=project.id,
        )
        # Event without user data (will have empty user tag)
        event = self.store_event(
            data={
                "timestamp": before_now(seconds=2).isoformat(),
            },
            project_id=project.id,
        )

        group = event.group

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/tags/user/values/"

        # This should not crash with AttributeError: 'NoneType' object has no attribute 'split'
        response = self.client.get(url)

        assert response.status_code == 200
        # Should return at least the user with id, empty values may or may not be included
        assert len(response.data) >= 1

    def test_count_sort(self) -> None:
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

    @mock.patch("sentry.analytics.record")
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_ratelimit(self, mock_record: mock.MagicMock) -> None:
        key, value = "foo", "bar"

        project = self.create_project()

        event = self.store_event(
            data={"tags": {key: value}, "timestamp": before_now(seconds=1).isoformat()},
            project_id=project.id,
        )
        group = event.group

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/tags/{key}/values/"

        with freeze_time(datetime.datetime.now()):
            for i in range(150):
                response = self.client.get(url)
                assert response.status_code == 200
            response = self.client.get(url)
            assert response.status_code == 429

        assert_last_analytics_event(
            mock_record,
            EventUserEndpointRequest(
                project_id=project.id,
                endpoint="sentry.api.endpoints.group_tagkey_values.get",
            ),
        )
