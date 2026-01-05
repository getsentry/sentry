import base64
from typing import Any
from unittest.mock import ANY, MagicMock, patch

from django.test.utils import override_settings

from sentry.models.organizationmember import OrganizationMember
from sentry.seer.explorer.client_utils import collect_user_org_context
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from tests.sentry.utils.test_jwt import RS256_KEY

RS256_KEY_B64 = base64.b64encode(RS256_KEY.encode()).decode()
CONDUIT_SETTINGS = {
    "CONDUIT_GATEWAY_PRIVATE_KEY": RS256_KEY_B64,
    "CONDUIT_GATEWAY_JWT_ISSUER": "sentry",
    "CONDUIT_GATEWAY_JWT_AUDIENCE": "conduit",
    "CONDUIT_GATEWAY_URL": "https://conduit.example.com",
}


@with_feature("organizations:seer-explorer")
@with_feature("organizations:gen-ai-features")
class OrganizationSeerExplorerChatEndpointTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-chat/"

    def test_get_without_run_id_returns_null_session(self) -> None:
        response = self.client.get(self.url)

        assert response.status_code == 404
        assert response.data == {"session": None}

    @patch("sentry.seer.endpoints.organization_seer_explorer_chat.SeerExplorerClient")
    def test_get_with_run_id_calls_client(self, mock_client_class: MagicMock) -> None:
        from sentry.seer.explorer.client_models import SeerRunState

        # Mock client response
        mock_state = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )
        mock_client = MagicMock()
        mock_client.get_run.return_value = mock_state
        mock_client_class.return_value = mock_client

        response = self.client.get(f"{self.url}123/")

        assert response.status_code == 200
        assert response.data["session"]["run_id"] == 123
        assert response.data["session"]["status"] == "completed"
        mock_client.get_run.assert_called_once_with(run_id=123)

    def test_post_without_query_returns_400(self) -> None:
        data: dict[str, Any] = {}
        response = self.client.post(self.url, data, format="json")

        assert response.status_code == 400

    def test_post_with_empty_query_returns_400(self) -> None:
        data = {"query": ""}
        response = self.client.post(self.url, data, format="json")

        assert response.status_code == 400

    @patch("sentry.seer.endpoints.organization_seer_explorer_chat.SeerExplorerClient")
    def test_post_without_streaming_flag_no_conduit(self, mock_client_class: MagicMock):
        mock_client_class.return_value.start_run.return_value = 123

        response = self.client.post(self.url, {"query": "test"}, format="json")

        assert response.status_code == 200
        assert response.data == {"run_id": 123}
        assert "conduit" not in response.data

    @override_settings(**CONDUIT_SETTINGS)
    @with_feature("organizations:seer-explorer-streaming")
    @patch("sentry.seer.endpoints.organization_seer_explorer_chat.SeerExplorerClient")
    def test_post_with_streaming_flag_includes_conduit(self, mock_client_class: MagicMock):
        mock_client_class.return_value.start_run.return_value = 123

        response = self.client.post(self.url, {"query": "test"}, format="json")

        assert response.status_code == 200
        assert response.data["run_id"] == 123
        assert "conduit" in response.data
        assert "token" in response.data["conduit"]
        assert "channel_id" in response.data["conduit"]
        assert "url" in response.data["conduit"]
        # Verify conduit params passed to client
        mock_client_class.return_value.start_run.assert_called_once()
        call_kwargs = mock_client_class.return_value.start_run.call_args.kwargs
        assert call_kwargs["conduit_channel_id"] is not None
        assert call_kwargs["conduit_url"] is not None

    @patch("sentry.seer.endpoints.organization_seer_explorer_chat.SeerExplorerClient")
    def test_post_new_conversation_calls_client(self, mock_client_class: MagicMock):
        mock_client = MagicMock()
        mock_client.start_run.return_value = 456
        mock_client_class.return_value = mock_client

        data = {"query": "What is this error about?"}
        response = self.client.post(self.url, data, format="json")

        assert response.status_code == 200
        assert response.data == {"run_id": 456}

        # Verify client was called correctly
        mock_client_class.assert_called_once_with(
            self.organization, ANY, is_interactive=True, enable_coding=True
        )
        mock_client.start_run.assert_called_once_with(
            prompt="What is this error about?",
            on_page_context=None,
            conduit_channel_id=None,
            conduit_url=None,
        )

    @patch("sentry.seer.endpoints.organization_seer_explorer_chat.SeerExplorerClient")
    def test_post_continue_conversation_calls_client(self, mock_client_class: MagicMock) -> None:
        mock_client = MagicMock()
        mock_client.continue_run.return_value = 789
        mock_client_class.return_value = mock_client

        data = {
            "query": "Follow up question",
            "insert_index": 2,
        }
        response = self.client.post(f"{self.url}789/", data, format="json")

        assert response.status_code == 200
        assert response.data == {"run_id": 789}

        # Verify client was called correctly
        mock_client_class.assert_called_once_with(
            self.organization, ANY, is_interactive=True, enable_coding=True
        )
        mock_client.continue_run.assert_called_once_with(
            run_id=789,
            prompt="Follow up question",
            insert_index=2,
            on_page_context=None,
            conduit_channel_id=None,
            conduit_url=None,
        )


class CollectUserOrgContextTest(APITestCase):
    """Test the collect_user_org_context helper function"""

    def setUp(self) -> None:
        super().setUp()
        self.project1 = self.create_project(
            organization=self.organization, teams=[self.team], slug="project-1"
        )
        self.project2 = self.create_project(
            organization=self.organization, teams=[self.team], slug="project-2"
        )
        self.other_team = self.create_team(organization=self.organization, slug="other-team")
        self.other_project = self.create_project(
            organization=self.organization, teams=[self.other_team], slug="other-project"
        )

    def test_collect_context_with_member(self):
        """Test context collection for a user who is an organization member"""
        context = collect_user_org_context(self.user, self.organization)

        assert context is not None
        assert context["org_slug"] == self.organization.slug
        assert context["user_id"] == self.user.id
        assert context["user_name"] == self.user.name
        assert context["user_email"] == self.user.email
        assert context["user_timezone"] is None  # No timezone set by default

        # Should have exactly one team
        assert len(context["user_teams"]) == 1
        assert context["user_teams"][0]["slug"] == self.team.slug

        # User projects should include project1 and project2 (both on self.team)
        user_project_slugs = {p["slug"] for p in context["user_projects"]}
        assert user_project_slugs == {"project-1", "project-2"}

        # All org projects should include all 3 projects
        all_project_slugs = {p["slug"] for p in context["all_org_projects"]}
        assert all_project_slugs == {"project-1", "project-2", "other-project"}
        all_project_ids = {p["id"] for p in context["all_org_projects"]}
        assert all_project_ids == {self.project1.id, self.project2.id, self.other_project.id}

    def test_collect_context_with_multiple_teams(self):
        """Test context collection for a user in multiple teams"""
        team2 = self.create_team(organization=self.organization, slug="team-2")
        member = OrganizationMember.objects.get(
            organization=self.organization, user_id=self.user.id
        )
        with unguarded_write(using="default"):
            member.teams.add(team2)

        context = collect_user_org_context(self.user, self.organization)

        assert context is not None
        team_slugs = {t["slug"] for t in context["user_teams"]}
        assert team_slugs == {self.team.slug, "team-2"}

    def test_collect_context_with_no_teams(self):
        """Test context collection for a member with no team membership"""
        member = OrganizationMember.objects.get(
            organization=self.organization, user_id=self.user.id
        )
        # Remove user from all teams
        with unguarded_write(using="default"):
            member.teams.clear()

        context = collect_user_org_context(self.user, self.organization)

        assert context is not None
        assert context["user_teams"] == []
        assert context["user_projects"] == []
        # All org projects should still be present
        all_project_slugs = {p["slug"] for p in context["all_org_projects"]}
        assert all_project_slugs == {"project-1", "project-2", "other-project"}

    def test_collect_context_with_timezone(self):
        """Test context collection includes user's timezone setting"""
        from sentry.users.services.user_option import user_option_service

        user_option_service.set_option(
            user_id=self.user.id, key="timezone", value="America/Los_Angeles"
        )

        context = collect_user_org_context(self.user, self.organization)

        assert context is not None
        assert context["user_timezone"] == "America/Los_Angeles"
