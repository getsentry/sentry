from unittest.mock import patch

import responses
from django.test.utils import override_settings

from sentry.integrations.mixins import IssueSyncMixin
from sentry.models import Integration
from sentry.testutils import APITestCase
from tests.fixtures.integrations.mock_service import StubService

TOKEN = "JWT anexampletoken"


class JiraWebhooksTest(APITestCase):
    endpoint = "sentry-extensions-jira-issue-updated"
    method = "post"

    def setUp(self):
        super().setUp()
        self.integration = Integration.objects.create(
            provider="jira",
            name="Example Jira",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        self.integration.add_organization(self.organization, self.user)

    @patch("sentry.integrations.jira.utils.api.sync_group_assignee_inbound")
    def test_simple_assign(self, mock_sync_group_assignee_inbound):
        with patch(
            "sentry.integrations.jira.webhooks.issue_updated.get_integration_from_jwt",
            return_value=self.integration,
        ):
            data = StubService.get_stub_data("jira", "edit_issue_assignee_payload.json")
            self.get_success_response(**data, extra_headers=dict(HTTP_AUTHORIZATION=TOKEN))
            mock_sync_group_assignee_inbound.assert_called_with(
                self.integration, "jess@sentry.io", "APP-123", assign=True
            )

    @override_settings(JIRA_USE_EMAIL_SCOPE=True)
    @patch("sentry.integrations.jira.utils.api.sync_group_assignee_inbound")
    @responses.activate
    def test_assign_use_email_api(self, mock_sync_group_assignee_inbound):
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/3/user/email",
            json={"accountId": "deadbeef123", "email": self.user.email},
            match_querystring=False,
        )

        with patch(
            "sentry.integrations.jira.webhooks.issue_updated.get_integration_from_jwt",
            return_value=self.integration,
        ):
            data = StubService.get_stub_data("jira", "edit_issue_assignee_payload.json")
            data["issue"]["fields"]["assignee"]["emailAddress"] = ""
            self.get_success_response(**data, extra_headers=dict(HTTP_AUTHORIZATION=TOKEN))
            assert mock_sync_group_assignee_inbound.called
            assert len(responses.calls) == 1

    @patch("sentry.integrations.jira.utils.api.sync_group_assignee_inbound")
    def test_assign_missing_email(self, mock_sync_group_assignee_inbound):
        with patch(
            "sentry.integrations.jira.webhooks.issue_updated.get_integration_from_jwt",
            return_value=self.integration,
        ):
            data = StubService.get_stub_data("jira", "edit_issue_assignee_payload.json")
            data["issue"]["fields"]["assignee"]["emailAddress"] = ""
            self.get_success_response(**data, extra_headers=dict(HTTP_AUTHORIZATION=TOKEN))
            assert not mock_sync_group_assignee_inbound.called

    @patch("sentry.integrations.jira.utils.api.sync_group_assignee_inbound")
    def test_simple_deassign(self, mock_sync_group_assignee_inbound):
        with patch(
            "sentry.integrations.jira.webhooks.issue_updated.get_integration_from_jwt",
            return_value=self.integration,
        ):
            data = StubService.get_stub_data("jira", "edit_issue_no_assignee_payload.json")
            self.get_success_response(**data, extra_headers=dict(HTTP_AUTHORIZATION=TOKEN))
            mock_sync_group_assignee_inbound.assert_called_with(
                self.integration, None, "APP-123", assign=False
            )

    @patch("sentry.integrations.jira.utils.api.sync_group_assignee_inbound")
    def test_simple_deassign_assignee_missing(self, mock_sync_group_assignee_inbound):
        with patch(
            "sentry.integrations.jira.webhooks.issue_updated.get_integration_from_jwt",
            return_value=self.integration,
        ):
            data = StubService.get_stub_data("jira", "edit_issue_assignee_missing_payload.json")
            self.get_success_response(**data, extra_headers=dict(HTTP_AUTHORIZATION=TOKEN))
            mock_sync_group_assignee_inbound.assert_called_with(
                self.integration, None, "APP-123", assign=False
            )

    @patch.object(IssueSyncMixin, "sync_status_inbound")
    def test_simple_status_sync_inbound(self, mock_sync_status_inbound):
        with patch(
            "sentry.integrations.jira.webhooks.issue_updated.get_integration_from_jwt",
            return_value=self.integration,
        ) as mock_get_integration_from_jwt:
            data = StubService.get_stub_data("jira", "edit_issue_status_payload.json")
            self.get_success_response(**data, extra_headers=dict(HTTP_AUTHORIZATION=TOKEN))
            mock_get_integration_from_jwt.assert_called_with(
                token="anexampletoken",
                path="/extensions/jira/issue-updated/",
                provider="jira",
                query_params={},
                method="POST",
            )
            mock_sync_status_inbound.assert_called_with(
                "APP-123",
                {
                    "changelog": {
                        "from": "10101",
                        "field": "status",
                        "fromString": "Done",
                        "to": "3",
                        "toString": "In Progress",
                        "fieldtype": "jira",
                        "fieldId": "status",
                    },
                    "issue": {
                        "fields": {"project": {"id": "10000", "key": "APP"}},
                        "key": "APP-123",
                    },
                },
            )

    def test_missing_changelog(self):
        with patch(
            "sentry.integrations.jira.webhooks.issue_updated.get_integration_from_jwt",
            return_value=self.integration,
        ):
            data = StubService.get_stub_data("jira", "changelog_missing.json")
            self.get_success_response(**data, extra_headers=dict(HTTP_AUTHORIZATION=TOKEN))
