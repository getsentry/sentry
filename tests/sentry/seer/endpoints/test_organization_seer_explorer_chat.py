from typing import Any
from unittest.mock import MagicMock, patch

from sentry.models.organizationmember import OrganizationMember
from sentry.seer.explorer.client_utils import collect_user_org_context
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


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

    @patch("sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_run")
    def test_get_with_run_id_calls_client(self, mock_get_seer_run: MagicMock) -> None:
        from sentry.seer.explorer.client_models import SeerRunState

        # Mock client response
        mock_state = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )
        mock_get_seer_run.return_value = mock_state

        response = self.client.get(f"{self.url}123/")

        assert response.status_code == 200
        assert response.data["session"]["run_id"] == 123
        assert response.data["session"]["status"] == "completed"
        assert mock_get_seer_run.call_count == 1

    def test_post_without_query_returns_400(self) -> None:
        data: dict[str, Any] = {}
        response = self.client.post(self.url, data, format="json")

        assert response.status_code == 400

    def test_post_with_empty_query_returns_400(self) -> None:
        data = {"query": ""}
        response = self.client.post(self.url, data, format="json")

        assert response.status_code == 400

    @patch("sentry.seer.endpoints.organization_seer_explorer_chat.start_seer_run")
    def test_post_new_conversation_calls_client(self, mock_start_seer_run: MagicMock):
        mock_start_seer_run.return_value = 456

        data = {"query": "What is this error about?"}
        response = self.client.post(self.url, data, format="json")

        assert response.status_code == 200
        assert response.data == {"run_id": 456}

        # Verify client was called
        assert mock_start_seer_run.call_count == 1
        call_kwargs = mock_start_seer_run.call_args[1]
        assert call_kwargs["organization"] == self.organization
        assert call_kwargs["prompt"] == "What is this error about?"
        assert call_kwargs["on_page_context"] is None

    @patch("sentry.seer.endpoints.organization_seer_explorer_chat.continue_seer_run")
    def test_post_continue_conversation_calls_client(
        self, mock_continue_seer_run: MagicMock
    ) -> None:
        mock_continue_seer_run.return_value = 789

        data = {
            "query": "Follow up question",
            "insert_index": 2,
        }
        response = self.client.post(f"{self.url}789/", data, format="json")

        assert response.status_code == 200
        assert response.data == {"run_id": 789}

        # Verify client was called
        assert mock_continue_seer_run.call_count == 1
        call_kwargs = mock_continue_seer_run.call_args[1]
        assert call_kwargs["organization"] == self.organization
        assert call_kwargs["prompt"] == "Follow up question"
        assert call_kwargs["run_id"] == 789
        assert call_kwargs["insert_index"] == 2
        assert call_kwargs["on_page_context"] is None


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
