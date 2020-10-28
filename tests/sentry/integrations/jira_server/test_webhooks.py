from __future__ import absolute_import

import jwt
import responses

from django.core.urlresolvers import reverse
from exam import fixture
from sentry.utils.compat.mock import patch
from requests.exceptions import ConnectionError

from sentry.integrations.jira_server.integration import JiraServerIntegration
from sentry.models import Integration, IdentityProvider, Identity, IdentityStatus
from sentry.testutils import APITestCase
from .testutils import EXAMPLE_PRIVATE_KEY


class JiraServerWebhookEndpointTest(APITestCase):
    @fixture
    def integration(self):
        integration = Integration.objects.create(
            provider="jira_server",
            name="Example Jira",
            metadata={
                "verify_ssl": False,
                "webhook_secret": "a long secret value",
                "base_url": "https://jira.example.org",
            },
        )
        identity_provider = IdentityProvider.objects.create(
            external_id="jira.example.org:sentry-test", type="jira_server"
        )
        identity = Identity.objects.create(
            idp=identity_provider,
            user=self.user,
            scopes=(),
            status=IdentityStatus.VALID,
            data={
                "consumer_key": "sentry-test",
                "private_key": EXAMPLE_PRIVATE_KEY,
                "access_token": "access-token",
                "access_token_secret": "access-token-secret",
            },
        )
        integration.add_organization(self.organization, self.user, default_auth_id=identity.id)
        return integration

    @property
    def jwt_token(self):
        integration = self.integration
        return jwt.encode({"id": integration.external_id}, integration.metadata["webhook_secret"])

    def test_post_empty_token(self):
        # Read the property to get side-effects in the database.
        token = self.jwt_token
        token = " "
        path = reverse("sentry-extensions-jiraserver-issue-updated", args=[token])
        resp = self.client.post(path)

        assert resp.status_code == 400

    def test_post_token_missing_id(self):
        integration = self.integration
        # No id key in the token
        token = jwt.encode({"no": integration.id}, integration.metadata["webhook_secret"])
        path = reverse("sentry-extensions-jiraserver-issue-updated", args=[token])
        resp = self.client.post(path)

        assert resp.status_code == 400

    def test_post_token_missing_integration(self):
        integration = self.integration
        # Use the wrong id in the token.
        token = jwt.encode({"no": integration.id}, integration.metadata["webhook_secret"])
        path = reverse("sentry-extensions-jiraserver-issue-updated", args=[token])
        resp = self.client.post(path)

        assert resp.status_code == 400

    def test_post_token_invalid_signature(self):
        integration = self.integration
        # Use the wrong id in the token.
        token = jwt.encode({"id": integration.external_id}, "bad-secret")
        path = reverse("sentry-extensions-jiraserver-issue-updated", args=[token])
        resp = self.client.post(path)

        assert resp.status_code == 400

    @patch("sentry.integrations.jira.webhooks.sync_group_assignee_inbound")
    def test_post_update_assignee(self, mock_sync):
        project = self.create_project()
        self.create_group(project=project)

        payload = {
            "changelog": {"items": [{"field": "assignee"}], "id": 12345},
            "issue": {"fields": {"assignee": {"emailAddress": "bob@example.org"}}, "key": "APP-1"},
        }
        token = self.jwt_token
        path = reverse("sentry-extensions-jiraserver-issue-updated", args=[token])
        resp = self.client.post(path, data=payload)
        assert resp.status_code == 200

        mock_sync.assert_called_with(self.integration, "bob@example.org", "APP-1", assign=True)

    @patch.object(JiraServerIntegration, "sync_status_inbound")
    def test_post_update_status(self, mock_sync):
        project = self.create_project()
        self.create_group(project=project)

        payload = {
            "changelog": {
                "items": [
                    {
                        "from": "10101",
                        "field": "status",
                        "fromString": "In Progress",
                        "to": "10102",
                        "toString": "Done",
                        "fieldtype": "jira",
                        "fieldId": "status",
                    }
                ],
                "id": 12345,
            },
            "issue": {"project": {"key": "APP", "id": "10000"}, "key": "APP-1"},
        }
        token = self.jwt_token
        path = reverse("sentry-extensions-jiraserver-issue-updated", args=[token])
        resp = self.client.post(path, data=payload)
        assert resp.status_code == 200

        mock_sync.assert_called_with(
            "APP-1", {"changelog": payload["changelog"]["items"][0], "issue": payload["issue"]}
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

        payload = {
            "changelog": {
                "items": [
                    {
                        "from": "10101",
                        "field": "status",
                        "fromString": "In Progress",
                        "to": "10102",
                        "toString": "Done",
                        "fieldtype": "jira",
                        "fieldId": "status",
                    }
                ],
                "id": 12345,
            },
            "issue": {"project": {"key": "APP", "id": "10000"}, "key": "APP-1"},
        }
        token = self.jwt_token
        path = reverse("sentry-extensions-jiraserver-issue-updated", args=[token])
        resp = self.client.post(path, data=payload)

        assert resp.status_code == 400
