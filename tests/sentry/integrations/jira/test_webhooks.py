from __future__ import absolute_import

import responses

from sentry.utils.compat.mock import patch

from django.test.utils import override_settings
from django.core.urlresolvers import reverse

from sentry.integrations.issues import IssueSyncMixin
from sentry.models import Integration
from sentry.testutils import APITestCase
from sentry.utils import json


SAMPLE_EDIT_ISSUE_PAYLOAD_NO_ASSIGNEE = """
{
    "changelog": {
        "items": [{
            "to": "admin",
            "field": "assignee",
            "toString": "Jess MacQueen",
            "from": null,
            "fromString": null,
            "fieldtype": "jira",
            "fieldId": "assignee"
        }],
        "id": "10172"
    },
    "issue": {
        "fields": {
            "assignee": null
        },
        "key": "APP-123"
    }
}
"""

SAMPLE_EDIT_ISSUE_PAYLOAD_MISSING_ASSIGNEE_FIELD = """
{
    "changelog": {
        "items": [{
            "field": "assignee",
            "from": null,
            "fromString": null,
            "fieldtype": "jira",
            "fieldId": "assignee"
        }],
        "id": "10172"
    },
    "issue": {
        "fields": {},
        "key": "APP-123"
    }
}
"""

SAMPLE_EDIT_ISSUE_PAYLOAD_ASSIGNEE = """
{
    "changelog": {
        "items": [{
            "to": "admin",
            "field": "assignee",
            "toString": "Jess MacQueen",
            "from": null,
            "fromString": null,
            "fieldtype": "jira",
            "fieldId": "assignee"
        }],
        "id": "10172"
    },
    "issue": {
        "fields": {
            "assignee": {
                "emailAddress": "jess@sentry.io",
                "accountId": "deadbeef123"
            }
        },
        "key": "APP-123"
    }
}
"""

SAMPLE_EDIT_ISSUE_PAYLOAD_STATUS = """
{
    "changelog": {
        "items": [{
            "from": "10101",
            "field": "status",
            "fromString": "Done",
            "to": "3",
            "toString": "In Progress",
            "fieldtype": "jira",
            "fieldId": "status"
        }],
        "id": "10196"
    },
    "issue": {
        "fields": {
            "project": {
                "id": "10000",
                "key": "APP"
            }
        },
        "key": "APP-123"
    }
}
"""

SAMPLE_MISSING_CHANGELOG = "{}"


class JiraWebhooksTest(APITestCase):
    @patch("sentry.integrations.jira.webhooks.sync_group_assignee_inbound")
    def test_simple_assign(self, mock_sync_group_assignee_inbound):
        org = self.organization

        integration = Integration.objects.create(provider="jira", name="Example Jira")
        integration.add_organization(org, self.user)

        path = reverse("sentry-extensions-jira-issue-updated")

        with patch(
            "sentry.integrations.jira.webhooks.get_integration_from_jwt", return_value=integration
        ):
            resp = self.client.post(
                path,
                data=json.loads(SAMPLE_EDIT_ISSUE_PAYLOAD_ASSIGNEE.strip()),
                HTTP_AUTHORIZATION="JWT anexampletoken",
            )
            assert resp.status_code == 200
            mock_sync_group_assignee_inbound.assert_called_with(
                integration, "jess@sentry.io", "APP-123", assign=True
            )

    @override_settings(JIRA_USE_EMAIL_SCOPE=True)
    @patch("sentry.integrations.jira.webhooks.sync_group_assignee_inbound")
    @responses.activate
    def test_assign_use_email_api(self, mock_sync_group_assignee_inbound):
        org = self.organization

        integration = Integration.objects.create(
            provider="jira",
            name="Example Jira",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        integration.add_organization(org, self.user)

        path = reverse("sentry-extensions-jira-issue-updated")

        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/3/user/email",
            json={"accountId": "deadbeef123", "email": self.user.email},
            match_querystring=False,
        )

        with patch(
            "sentry.integrations.jira.webhooks.get_integration_from_jwt", return_value=integration
        ):
            data = json.loads(SAMPLE_EDIT_ISSUE_PAYLOAD_ASSIGNEE.strip())
            data["issue"]["fields"]["assignee"]["emailAddress"] = ""
            resp = self.client.post(path, data=data, HTTP_AUTHORIZATION="JWT anexampletoken")
            assert resp.status_code == 200
            assert mock_sync_group_assignee_inbound.called
            assert len(responses.calls) == 1

    @patch("sentry.integrations.jira.webhooks.sync_group_assignee_inbound")
    def test_assign_missing_email(self, mock_sync_group_assignee_inbound):
        org = self.organization

        integration = Integration.objects.create(provider="jira", name="Example Jira")
        integration.add_organization(org, self.user)

        path = reverse("sentry-extensions-jira-issue-updated")

        with patch(
            "sentry.integrations.jira.webhooks.get_integration_from_jwt", return_value=integration
        ):
            data = json.loads(SAMPLE_EDIT_ISSUE_PAYLOAD_ASSIGNEE.strip())
            data["issue"]["fields"]["assignee"]["emailAddress"] = ""
            resp = self.client.post(path, data=data, HTTP_AUTHORIZATION="JWT anexampletoken")
            assert resp.status_code == 200
            assert not mock_sync_group_assignee_inbound.called

    @patch("sentry.integrations.jira.webhooks.sync_group_assignee_inbound")
    def test_simple_deassign(self, mock_sync_group_assignee_inbound):
        org = self.organization

        integration = Integration.objects.create(provider="jira", name="Example Jira")
        integration.add_organization(org, self.user)

        path = reverse("sentry-extensions-jira-issue-updated")

        with patch(
            "sentry.integrations.jira.webhooks.get_integration_from_jwt", return_value=integration
        ):
            resp = self.client.post(
                path,
                data=json.loads(SAMPLE_EDIT_ISSUE_PAYLOAD_NO_ASSIGNEE.strip()),
                HTTP_AUTHORIZATION="JWT anexampletoken",
            )
            assert resp.status_code == 200
            mock_sync_group_assignee_inbound.assert_called_with(
                integration, None, "APP-123", assign=False
            )

    @patch("sentry.integrations.jira.webhooks.sync_group_assignee_inbound")
    def test_simple_deassign_assignee_missing(self, mock_sync_group_assignee_inbound):
        org = self.organization

        integration = Integration.objects.create(provider="jira", name="Example Jira")
        integration.add_organization(org, self.user)

        path = reverse("sentry-extensions-jira-issue-updated")

        with patch(
            "sentry.integrations.jira.webhooks.get_integration_from_jwt", return_value=integration
        ):
            resp = self.client.post(
                path,
                data=json.loads(SAMPLE_EDIT_ISSUE_PAYLOAD_MISSING_ASSIGNEE_FIELD.strip()),
                HTTP_AUTHORIZATION="JWT anexampletoken",
            )
            assert resp.status_code == 200
            mock_sync_group_assignee_inbound.assert_called_with(
                integration, None, "APP-123", assign=False
            )

    @patch.object(IssueSyncMixin, "sync_status_inbound")
    def test_simple_status_sync_inbound(self, mock_sync_status_inbound):
        org = self.organization

        integration = Integration.objects.create(provider="jira", name="Example Jira")
        integration.add_organization(org, self.user)

        path = reverse("sentry-extensions-jira-issue-updated")

        with patch(
            "sentry.integrations.jira.webhooks.get_integration_from_jwt", return_value=integration
        ) as mock_get_integration_from_jwt:
            resp = self.client.post(
                path,
                data=json.loads(SAMPLE_EDIT_ISSUE_PAYLOAD_STATUS.strip()),
                HTTP_AUTHORIZATION="JWT anexampletoken",
            )
            assert resp.status_code == 200
            mock_get_integration_from_jwt.assert_called_with(
                "anexampletoken", u"/extensions/jira/issue-updated/", "jira", {}, method="POST"
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
                        u"key": u"APP-123",
                    },
                },
            )

    def test_missing_changelog(self):
        org = self.organization

        integration = Integration.objects.create(provider="jira", name="Example Jira")
        integration.add_organization(org, self.user)

        path = reverse("sentry-extensions-jira-issue-updated")

        with patch(
            "sentry.integrations.jira.webhooks.get_integration_from_jwt", return_value=integration
        ):
            resp = self.client.post(
                path,
                data=json.loads(SAMPLE_MISSING_CHANGELOG.strip()),
                HTTP_AUTHORIZATION="JWT anexampletoken",
            )
            assert resp.status_code == 200
