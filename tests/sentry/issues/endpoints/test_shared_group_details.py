from collections.abc import Callable

from sentry.models.groupshare import GroupShare
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class SharedGroupDetailsTest(APITestCase):
    def _get_path_functions(
        self,
    ) -> tuple[Callable[[str], str], Callable[[str], str]]:
        return (
            lambda share_id: f"/api/0/organizations/{self.organization.slug}/shared/issues/{share_id}/",
            lambda share_id: f"/api/0/organizations/{self.organization.id}/shared/issues/{share_id}/",
        )

    def test_simple(self) -> None:
        self.login_as(user=self.user)

        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(data={"timestamp": min_ago}, project_id=self.project.id)
        assert event.group is not None
        group = event.group

        share_id = group.get_share_id()
        assert share_id is None

        GroupShare.objects.create(project_id=group.project_id, group=group)

        share_id = group.get_share_id()
        assert share_id is not None

        for path_func in self._get_path_functions():
            path = path_func(share_id)
            response = self.client.get(path, format="json")

            assert response.status_code == 200, response.content
            assert response.data["id"] == str(group.id)
            assert response.data["latestEvent"]["id"] == str(event.event_id)
            assert response.data["project"]["slug"] == group.project.slug
            assert response.data["project"]["organization"]["slug"] == group.organization.slug

    def test_does_not_leak_assigned_to(self) -> None:
        self.login_as(user=self.user)

        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(data={"timestamp": min_ago}, project_id=self.project.id)
        assert event.group is not None
        group = event.group

        share_id = group.get_share_id()
        assert share_id is None

        GroupShare.objects.create(project_id=group.project_id, group=group)

        share_id = group.get_share_id()
        assert share_id is not None

        for path_func in self._get_path_functions():
            path = path_func(share_id)
            response = self.client.get(path, format="json")

            assert response.status_code == 200, response.content
            assert response.data["id"] == str(group.id)
            assert response.data["latestEvent"]["id"] == str(event.event_id)
            assert response.data["project"]["slug"] == group.project.slug
            assert response.data["project"]["organization"]["slug"] == group.organization.slug
            assert "assignedTo" not in response.data

    def test_feature_disabled(self) -> None:
        self.login_as(user=self.user)

        group = self.create_group()
        org = group.organization
        org.flags.disable_shared_issues = True
        org.save()

        share_id = group.get_share_id()
        assert share_id is None

        GroupShare.objects.create(project_id=group.project_id, group=group)

        share_id = group.get_share_id()
        assert share_id is not None

        for path_func in self._get_path_functions():
            path = path_func(share_id)
            response = self.client.get(path, format="json")

            assert response.status_code == 404

    def test_permalink(self) -> None:
        group = self.create_group()

        share_id = group.get_share_id()
        assert share_id is None

        GroupShare.objects.create(project_id=group.project_id, group=group)

        share_id = group.get_share_id()
        assert share_id is not None

        for path_func in self._get_path_functions():
            path = path_func(share_id)
            response = self.client.get(path, format="json")

            assert response.status_code == 200, response.content
            assert response.data["permalink"]

    def test_markdown_with_accept_header(self) -> None:
        """Test that markdown is returned when Accept: text/markdown header is sent."""
        self.login_as(user=self.user)

        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={
                "timestamp": min_ago,
                "message": "Test error message",
                "exception": {
                    "values": [
                        {
                            "type": "ValueError",
                            "value": "Test exception value",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "filename": "test.py",
                                        "function": "test_function",
                                        "lineNo": 42,
                                    }
                                ]
                            },
                        }
                    ]
                },
            },
            project_id=self.project.id,
        )
        assert event.group is not None
        group = event.group

        GroupShare.objects.create(project_id=group.project_id, group=group)
        share_id = group.get_share_id()
        assert share_id is not None

        for path_func in self._get_path_functions():
            path = path_func(share_id)
            response = self.client.get(path, HTTP_ACCEPT="text/markdown")

            assert response.status_code == 200, response.content
            assert response["Content-Type"] == "text/markdown; charset=utf-8"

            # Verify markdown content includes key information
            content = response.content.decode("utf-8")
            assert "# " in content  # Title
            assert "## Issue Details" in content
            assert group.qualified_short_id in content
            assert self.project.slug in content
            assert self.organization.slug in content

    def test_markdown_with_cursor_user_agent(self) -> None:
        """Test that markdown is returned when User-Agent indicates Cursor AI agent."""
        self.login_as(user=self.user)

        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(data={"timestamp": min_ago}, project_id=self.project.id)
        assert event.group is not None
        group = event.group

        GroupShare.objects.create(project_id=group.project_id, group=group)
        share_id = group.get_share_id()
        assert share_id is not None

        for path_func in self._get_path_functions():
            path = path_func(share_id)
            response = self.client.get(path, HTTP_USER_AGENT="cursor-ai/1.0")

            assert response.status_code == 200, response.content
            assert response["Content-Type"] == "text/markdown; charset=utf-8"

            content = response.content.decode("utf-8")
            assert "# " in content
            assert group.qualified_short_id in content

    def test_markdown_with_claude_user_agent(self) -> None:
        """Test that markdown is returned when User-Agent indicates Claude AI agent."""
        self.login_as(user=self.user)

        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(data={"timestamp": min_ago}, project_id=self.project.id)
        assert event.group is not None
        group = event.group

        GroupShare.objects.create(project_id=group.project_id, group=group)
        share_id = group.get_share_id()
        assert share_id is not None

        for path_func in self._get_path_functions():
            path = path_func(share_id)
            response = self.client.get(path, HTTP_USER_AGENT="Claude/1.0")

            assert response.status_code == 200, response.content
            assert response["Content-Type"] == "text/markdown; charset=utf-8"

    def test_json_without_markdown_headers(self) -> None:
        """Test that JSON is still returned when neither Accept header nor AI User-Agent is present."""
        self.login_as(user=self.user)

        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(data={"timestamp": min_ago}, project_id=self.project.id)
        assert event.group is not None
        group = event.group

        GroupShare.objects.create(project_id=group.project_id, group=group)
        share_id = group.get_share_id()
        assert share_id is not None

        for path_func in self._get_path_functions():
            path = path_func(share_id)
            # Regular request without special headers
            response = self.client.get(path, format="json")

            assert response.status_code == 200, response.content
            # Should be JSON response
            assert hasattr(response, "data")
            assert response.data["id"] == str(group.id)
