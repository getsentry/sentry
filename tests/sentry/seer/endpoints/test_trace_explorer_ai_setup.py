from unittest.mock import patch

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


class TraceExplorerAISetupTest(APITestCase):
    endpoint = "sentry-api-0-trace-explorer-ai-setup"

    method = "post"

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.seer.endpoints.trace_explorer_ai_setup.fire_setup_request")
    def test_simple(self, mock_fire_setup_request):
        self.login_as(self.user)

        response = self.get_success_response(
            self.organization.slug,
            status_code=200,
            project_ids=[self.project.id],
        )

        assert response.data == {"status": "ok"}
        mock_fire_setup_request.assert_called_once_with(self.organization.id, [self.project.id])

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.seer.endpoints.trace_explorer_ai_setup.fire_setup_request")
    def test_rejects_project_from_other_org(self, mock_fire_setup_request):
        """Test that requesting projects from another org returns 403"""
        other_org = self.create_organization(owner=self.user)
        other_project = self.create_project(organization=other_org)

        self.login_as(self.user)

        response = self.get_error_response(
            self.organization.slug,
            status_code=403,
            project_ids=[other_project.id],
        )

        assert response.data == {"detail": "You do not have permission to perform this action."}
        mock_fire_setup_request.assert_not_called()

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.seer.endpoints.trace_explorer_ai_setup.fire_setup_request")
    def test_rejects_nonexistent_project(self, mock_fire_setup_request):
        """Test that requesting non-existent project returns same error as inaccessible project"""
        self.login_as(self.user)

        response = self.get_error_response(
            self.organization.slug,
            status_code=403,
            project_ids=[999999999],
        )

        assert response.data == {"detail": "You do not have permission to perform this action."}
        mock_fire_setup_request.assert_not_called()

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.seer.endpoints.trace_explorer_ai_setup.fire_setup_request")
    def test_empty_projects_still_calls_seer(self, mock_fire_setup_request):
        """Test that empty project list is handled"""
        self.login_as(self.user)

        response = self.get_success_response(
            self.organization.slug,
            status_code=200,
            project_ids=[],
        )

        assert response.data == {"status": "ok"}
        mock_fire_setup_request.assert_called_once_with(self.organization.id, [])

    def test_requires_feature_flag(self):
        self.login_as(self.user)

        response = self.get_error_response(
            self.organization.slug,
            status_code=403,
            project_ids=[self.project.id],
        )

        assert response.data == {"detail": "Organization does not have access to this feature"}

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.seer.endpoints.trace_explorer_ai_setup.fire_setup_request")
    def test_invalid_project_id_returns_400(self, mock_fire_setup_request):
        """Test that non-integer project_id returns 400"""
        self.login_as(self.user)

        response = self.get_error_response(
            self.organization.slug,
            status_code=400,
            project_ids=["abc"],
        )

        assert response.data["detail"] == "Invalid project_id value"
        mock_fire_setup_request.assert_not_called()

    @with_feature("organizations:gen-ai-features")
    @patch("sentry.seer.endpoints.trace_explorer_ai_setup.fire_setup_request")
    def test_negative_project_id_returns_400(self, mock_fire_setup_request):
        """Test that negative project_id (like -1 sentinel) returns 400"""
        self.login_as(self.user)

        response = self.get_error_response(
            self.organization.slug,
            status_code=400,
            project_ids=[-1],
        )

        assert response.data["detail"] == "Invalid project_id value"
        mock_fire_setup_request.assert_not_called()

    @with_feature("organizations:gen-ai-features")
    def test_requires_authentication(self):
        response = self.get_error_response(
            self.organization.slug,
            status_code=401,
            project_ids=[self.project.id],
        )

        assert response.data == {"detail": "Authentication credentials were not provided."}
