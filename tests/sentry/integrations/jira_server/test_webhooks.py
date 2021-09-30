import jwt
import responses
from exam import fixture
from requests.exceptions import ConnectionError

from sentry.integrations.jira_server.integration import JiraServerIntegration
from sentry.models import OrganizationIntegration
from sentry.testutils import APITestCase
from sentry.utils.compat.mock import patch

from . import EXAMPLE_PAYLOAD, get_integration


class JiraServerWebhookEndpointTest(APITestCase):
    endpoint = "sentry-extensions-jiraserver-issue-updated"
    method = "post"

    @fixture
    def integration(self):
        return get_integration(self.organization, self.user)

    @property
    def jwt_token(self):
        integration = self.integration
        return jwt.encode({"id": integration.external_id}, integration.metadata["webhook_secret"])

    def test_post_empty_token(self):
        # Read the property to get side-effects in the database.
        _ = self.jwt_token

        self.get_error_response(" ", status_code=400)

    def test_post_missing_default_identity(self):
        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
        )
        org_integration.update(default_auth_id=None, config={"sync_status_reverse": True})

        with self.tasks():
            self.get_error_response(self.jwt_token, **EXAMPLE_PAYLOAD, status_code=400)

    def test_post_token_missing_id(self):
        integration = self.integration
        # No id key in the token
        token = jwt.encode({"no": integration.id}, integration.metadata["webhook_secret"])
        self.get_error_response(token, status_code=400)

    def test_post_token_missing_integration(self):
        integration = self.integration
        # Use the wrong id in the token.
        token = jwt.encode({"no": integration.id}, integration.metadata["webhook_secret"])
        self.get_error_response(token, status_code=400)

    def test_post_token_invalid_signature(self):
        integration = self.integration
        # Use the wrong id in the token.
        token = jwt.encode({"id": integration.external_id}, "bad-secret")
        self.get_error_response(token, status_code=400)

    @patch("sentry.integrations.jira.webhooks.sync_group_assignee_inbound")
    def test_post_update_assignee(self, mock_sync):
        project = self.create_project()
        self.create_group(project=project)

        payload = {
            "changelog": {"items": [{"field": "assignee"}], "id": 12345},
            "issue": {"fields": {"assignee": {"emailAddress": "bob@example.org"}}, "key": "APP-1"},
        }
        self.get_success_response(self.jwt_token, **payload)

        mock_sync.assert_called_with(self.integration, "bob@example.org", "APP-1", assign=True)

    @patch.object(JiraServerIntegration, "sync_status_inbound")
    def test_post_update_status(self, mock_sync):
        project = self.create_project()
        self.create_group(project=project)

        self.get_success_response(self.jwt_token, **EXAMPLE_PAYLOAD)

        mock_sync.assert_called_with(
            "APP-1",
            {
                "changelog": EXAMPLE_PAYLOAD["changelog"]["items"][0],
                "issue": EXAMPLE_PAYLOAD["issue"],
            },
        )

    @responses.activate
    def test_post_update_status_token_error(self):
        responses.add(
            method=responses.GET,
            url="https://jira.example.org/rest/api/2/status",
            body=ConnectionError(),
        )
        project = self.create_project()
        self.create_group(project=project)
        integration = self.integration
        installation = integration.get_installation(self.organization.id)
        installation.update_organization_config({"sync_status_reverse": True})

        with self.tasks():
            self.get_error_response(self.jwt_token, **EXAMPLE_PAYLOAD, status_code=400)
