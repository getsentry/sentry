from unittest.mock import MagicMock, patch

from sentry.seer.endpoints.organization_seer_explorer_chat import _collect_user_org_context
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.requests import drf_request_from_request


@with_feature("organizations:seer-explorer")
@with_feature("organizations:gen-ai-features")
class OrganizationSeerExplorerChatEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-chat/"
        self.login_as(user=self.user)

    def test_get_without_run_id_returns_null_session(self) -> None:
        with patch(
            "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
            return_value=True,
        ):
            response = self.client.get(self.url)

        assert response.status_code == 404
        assert response.data == {"session": None}

    @patch("sentry.seer.endpoints.organization_seer_explorer_chat._call_seer_explorer_state")
    def test_get_with_run_id_calls_seer(self, mock_call_seer_state: MagicMock) -> None:
        mock_response = {
            "session": {
                "run_id": 123,
                "messages": [],
                "status": "completed",
                "updated_at": "2024-01-01T00:00:00Z",
            }
        }
        mock_call_seer_state.return_value = mock_response

        with patch(
            "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
            return_value=True,
        ):
            response = self.client.get(f"{self.url}123/")

        assert response.status_code == 200
        assert response.data == mock_response
        mock_call_seer_state.assert_called_once_with(self.organization, "123")

    def test_post_without_query_returns_400(self) -> None:
        with patch(
            "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
            return_value=True,
        ):
            response = self.client.post(self.url, {}, format="json")

            assert response.status_code == 400
            assert response.data == {"query": ["This field is required."]}

    def test_post_with_empty_query_returns_400(self) -> None:
        with patch(
            "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
            return_value=True,
        ):
            response = self.client.post(self.url, {"query": "   "}, format="json")

            assert response.status_code == 400
            assert response.data == {"query": ["This field may not be blank."]}

    def test_post_with_invalid_json_returns_400(self) -> None:
        with patch(
            "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
            return_value=True,
        ):
            response = self.client.post(self.url, "invalid json", content_type="application/json")

            assert response.status_code == 400
            assert "detail" in response.data
            assert "JSON parse error" in str(response.data["detail"])

    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
        return_value=True,
    )
    @patch("sentry.seer.endpoints.organization_seer_explorer_chat._call_seer_explorer_chat")
    @patch("sentry.seer.endpoints.organization_seer_explorer_chat._collect_user_org_context")
    def test_post_with_query_calls_seer(
        self, mock_collect_context, mock_call_seer_chat, mock_get_seer_org_acknowledgement
    ):
        mock_context = {
            "org_slug": self.organization.slug,
            "user_name": self.user.name,
            "user_email": self.user.email,
            "user_teams": [],
            "user_projects": [],
            "all_org_projects": [],
        }
        mock_collect_context.return_value = mock_context
        mock_response = {
            "run_id": 456,
            "message": {
                "id": "msg-1",
                "type": "response",
                "content": "Hello! How can I help?",
                "timestamp": "2024-01-01T00:00:00Z",
                "loading": False,
            },
        }
        mock_call_seer_chat.return_value = mock_response

        data = {"query": "What is this error about?"}
        response = self.client.post(self.url, data, format="json")

        assert response.status_code == 200
        assert response.data == mock_response
        mock_collect_context.assert_called_once()
        mock_call_seer_chat.assert_called_once_with(
            organization=self.organization,
            run_id=None,
            query="What is this error about?",
            insert_index=None,
            message_timestamp=None,
            on_page_context=None,
            user_org_context=mock_context,
        )

    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
        return_value=True,
    )
    @patch("sentry.seer.endpoints.organization_seer_explorer_chat._call_seer_explorer_chat")
    @patch("sentry.seer.endpoints.organization_seer_explorer_chat._collect_user_org_context")
    def test_post_with_all_parameters(
        self,
        mock_collect_context: MagicMock,
        mock_call_seer_chat: MagicMock,
        mock_get_seer_org_acknowledgement: MagicMock,
    ) -> None:
        mock_response = {"run_id": 789, "message": {}}
        mock_call_seer_chat.return_value = mock_response

        data = {
            "query": "Follow up question",
            "insert_index": 2,
            "message_timestamp": 1704067200.0,
        }
        response = self.client.post(f"{self.url}789/", data, format="json")

        assert response.status_code == 200
        assert response.data == mock_response
        # Context should not be collected for existing runs (run_id is present)
        mock_collect_context.assert_not_called()
        mock_call_seer_chat.assert_called_once_with(
            organization=self.organization,
            run_id="789",
            query="Follow up question",
            insert_index=2,
            message_timestamp=1704067200.0,
            on_page_context=None,
            user_org_context=None,
        )

    def test_post_with_ai_features_disabled_returns_403(self) -> None:
        # Set the organization option to hide AI features
        self.organization.update_option("sentry:hide_ai_features", True)

        with patch(
            "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
            return_value=True,
        ):
            data = {"query": "Test query"}
            response = self.client.post(self.url, data, format="json")

            assert response.status_code == 403
            assert response.data == {"detail": "AI features are disabled for this organization."}

    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
        return_value=False,
    )
    def test_post_without_acknowledgement_returns_403(
        self, mock_get_seer_org_acknowledgement: MagicMock
    ) -> None:
        data = {"query": "Test query"}
        response = self.client.post(self.url, data, format="json")

        assert response.status_code == 403
        assert response.data == {"detail": "Seer has not been acknowledged by the organization."}
        mock_get_seer_org_acknowledgement.assert_called_once_with(self.organization.id)

    def test_post_without_open_team_membership_returns_403(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        with patch(
            "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
            return_value=True,
        ):
            data = {"query": "Test query"}
            response = self.client.post(self.url, data, format="json")

            assert response.status_code == 403
            assert (
                response.data["detail"]
                == "Organization does not have open team membership enabled. Seer requires this to aggregate context across all projects and allow members to ask questions freely."
            )

    def test_get_without_open_team_membership_returns_403(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        with patch(
            "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
            return_value=True,
        ):
            response = self.client.get(f"{self.url}123/")

            assert response.status_code == 403
            assert (
                response.data["detail"]
                == "Organization does not have open team membership enabled. Seer requires this to aggregate context across all projects and allow members to ask questions freely."
            )


class OrganizationSeerExplorerChatEndpointFeatureFlagTest(APITestCase):
    """Test feature flag requirements separately without the decorator"""

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-chat/"
        self.login_as(user=self.user)

    def test_post_without_gen_ai_features_flag_returns_400(self) -> None:
        # Only enable seer-explorer but not gen-ai-features
        with self.feature({"organizations:seer-explorer": True}):
            with patch(
                "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
                return_value=True,
            ):
                data = {"query": "Test query"}
                response = self.client.post(self.url, data, format="json")

                assert response.status_code == 400
                assert response.data == {"detail": "Feature flag not enabled"}

    def test_post_without_seer_explorer_flag_returns_400(self) -> None:
        # Only enable gen-ai-features but not seer-explorer
        with self.feature({"organizations:gen-ai-features": True}):
            with patch(
                "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
                return_value=True,
            ):
                data = {"query": "Test query"}
                response = self.client.post(self.url, data, format="json")

                assert response.status_code == 400
                assert response.data == {"detail": "Feature flag not enabled"}

    def test_post_without_any_feature_flags_returns_400(self) -> None:
        # No feature flags enabled
        with patch(
            "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
            return_value=True,
        ):
            data = {"query": "Test query"}
            response = self.client.post(self.url, data, format="json")

            assert response.status_code == 400
            assert response.data == {"detail": "Feature flag not enabled"}

    @patch(
        "sentry.seer.endpoints.organization_seer_explorer_chat.get_seer_org_acknowledgement",
        return_value=True,
    )
    @patch("sentry.seer.endpoints.organization_seer_explorer_chat._call_seer_explorer_chat")
    @patch("sentry.seer.endpoints.organization_seer_explorer_chat._collect_user_org_context")
    def test_post_with_both_feature_flags_succeeds(
        self, mock_collect_context, mock_call_seer_chat, mock_get_seer_org_acknowledgement
    ):
        # Enable both required feature flags
        with self.feature(
            {"organizations:gen-ai-features": True, "organizations:seer-explorer": True}
        ):
            mock_context = {
                "org_slug": self.organization.slug,
                "user_name": self.user.name,
                "user_email": self.user.email,
                "user_teams": [],
                "user_projects": [],
                "all_org_projects": [],
            }
            mock_collect_context.return_value = mock_context
            mock_response = {"run_id": 1, "message": {}}
            mock_call_seer_chat.return_value = mock_response

            data = {"query": "Test query"}
            response = self.client.post(self.url, data, format="json")

            assert response.status_code == 200
            assert response.data == mock_response
            mock_call_seer_chat.assert_called_once_with(
                organization=self.organization,
                run_id=None,
                query="Test query",
                insert_index=None,
                message_timestamp=None,
                on_page_context=None,
                user_org_context=mock_context,
            )


class CollectUserOrgContextTest(APITestCase):
    """Test the _collect_user_org_context helper function"""

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(name="Test Org")
        self.user = self.create_user(name="Test User", email="test@example.com")
        self.team = self.create_team(organization=self.organization, slug="test-team")
        self.member = self.create_member(
            organization=self.organization, user=self.user, teams=[self.team]
        )
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
        http_request = self.make_request(user=self.user)
        request = drf_request_from_request(http_request)
        context = _collect_user_org_context(request, self.organization)

        assert context is not None
        assert context["org_slug"] == self.organization.slug
        assert context["user_name"] == self.user.name
        assert context["user_email"] == self.user.email

        # Check user teams
        assert len(context["user_teams"]) == 1
        assert context["user_teams"][0]["slug"] == "test-team"

        # Check user projects (My Projects)
        user_project_slugs = {p["slug"] for p in context["user_projects"]}
        assert user_project_slugs == {"project-1", "project-2"}

        # Check all org projects
        all_project_slugs = {p["slug"] for p in context["all_org_projects"]}
        assert all_project_slugs == {"project-1", "project-2", "other-project"}

    def test_collect_context_with_multiple_teams(self):
        """Test context collection for a user in multiple teams"""
        team2 = self.create_team(organization=self.organization, slug="team-2")
        with unguarded_write(using="default"):
            self.member.teams.add(team2)

        http_request = self.make_request(user=self.user)
        request = drf_request_from_request(http_request)
        context = _collect_user_org_context(request, self.organization)

        assert context is not None
        team_slugs = {t["slug"] for t in context["user_teams"]}
        assert team_slugs == {"test-team", "team-2"}

    def test_collect_context_with_no_teams(self):
        """Test context collection for a member with no team membership"""
        # Remove user from all teams
        with unguarded_write(using="default"):
            self.member.teams.clear()

        http_request = self.make_request(user=self.user)
        request = drf_request_from_request(http_request)
        context = _collect_user_org_context(request, self.organization)

        assert context is not None
        assert context["user_teams"] == []
        assert context["user_projects"] == []
        # Should still have all org projects
        assert len(context["all_org_projects"]) == 3
