from datetime import datetime

from django.utils import timezone
from jwt import ExpiredSignatureError

from sentry.integrations.atlassian_connect import AtlassianConnectValidationError
from sentry.models import ExternalIssue, Group, GroupLink, Integration
from sentry.testutils import APITestCase
from sentry.utils.compat.mock import patch
from sentry.utils.http import absolute_uri

UNABLE_TO_VERIFY_INSTALLATION = b"Unable to verify installation"
REFRESH_REQUIRED = b"This page has expired, please refresh to view the Sentry issue"
CLICK_TO_FINISH = b"Click to Finish Installation"


class JiraIssueHookTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.first_seen = datetime(2015, 8, 13, 3, 8, 25, tzinfo=timezone.utc)
        self.last_seen = datetime(2016, 1, 13, 3, 8, 25, tzinfo=timezone.utc)
        self.first_release = self.create_release(
            project=self.project, version="v1.0", date_added=self.first_seen
        )
        self.last_release = self.create_release(
            project=self.project, version="v1.1", date_added=self.last_seen
        )

        self.group = self.create_group(
            self.project,
            message="Sentry Error",
            first_seen=self.first_seen,
            last_seen=self.last_seen,
            first_release=self.first_release,
        )
        group = self.group
        self.path = absolute_uri("extensions/jira/issue/APP-123/") + "?xdm_e=base_url"

        self.integration = Integration.objects.create(
            provider="jira",
            name="Example Jira",
            metadata={"base_url": "https://getsentry.atlassian.net"},
        )
        self.integration.add_organization(self.organization, self.user)

        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id, integration_id=self.integration.id, key="APP-123"
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        self.login_as(self.user)

    @patch(
        "sentry.integrations.jira.issue_hook.get_integration_from_request",
        side_effect=ExpiredSignatureError(),
    )
    def test_expired_signature_error(self, mock_get_integration_from_request):
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert REFRESH_REQUIRED in response.content

    @patch(
        "sentry.integrations.jira.issue_hook.get_integration_from_request",
        side_effect=AtlassianConnectValidationError(),
    )
    def test_expired_invalid_installation_error(self, mock_get_integration_from_request):
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert UNABLE_TO_VERIFY_INSTALLATION in response.content

    @patch.object(Group, "get_last_release")
    @patch("sentry.integrations.jira.issue_hook.get_integration_from_request")
    def test_simple_get(self, mock_get_integration_from_request, mock_get_last_release):
        mock_get_last_release.return_value = self.last_release.version
        mock_get_integration_from_request.return_value = self.integration
        response = self.client.get(self.path)
        assert response.status_code == 200
        resp_content = str(response.content)
        assert self.group.title in resp_content
        assert self.first_seen.strftime("%b. %d, %Y") in resp_content
        assert self.last_seen.strftime("%b. %d, %Y") in resp_content
        assert self.first_release.version in resp_content
        assert self.last_release.version in resp_content

    @patch("sentry.integrations.jira.issue_hook.get_integration_from_request")
    def test_simple_not_linked(self, mock_get_integration_from_request):
        mock_get_integration_from_request.return_value = self.integration
        path = absolute_uri("extensions/jira/issue/bad-key/") + "?xdm_e=base_url"
        response = self.client.get(path)
        assert response.status_code == 200
        assert b"This Sentry issue is not linked to a Jira issue" in response.content
