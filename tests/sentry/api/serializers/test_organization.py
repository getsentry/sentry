from django.conf import settings

from sentry import features
from sentry.auth import access
from sentry.api.serializers import serialize, DetailedOrganizationSerializer
from sentry.testutils import TestCase
from sentry.utils.compat import mock
from sentry.features.base import OrganizationFeature


class OrganizationSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)

        result = serialize(organization, user)

        assert result["id"] == str(organization.id)
        assert result["features"] == {
            "advanced-search",
            "custom-event-title",
            "custom-symbol-sources",
            "data-forwarding",
            "discover-basic",
            "discover-query",
            "event-attachments",
            "event-attachments-viewer",
            "integrations-alert-rule",
            "integrations-chat-unfurl",
            "integrations-event-hooks",
            "integrations-incident-management",
            "integrations-issue-basic",
            "integrations-issue-sync",
            "integrations-ticket-rules",
            "invite-members",
            "invite-members-rate-limits",
            "open-membership",
            "relay",
            "shared-issues",
            "sso-basic",
            "sso-saml2",
            "symbol-sources",
            "unhandled-issue-flag",
        }

    @mock.patch("sentry.features.batch_has")
    def test_organization_batch_has(self, mock_batch):
        user = self.create_user()
        organization = self.create_organization(owner=user)

        features.add("organizations:test-feature", OrganizationFeature)
        features.add("organizations:disabled-feature", OrganizationFeature)
        mock_batch.return_value = {
            f"organization:{organization.id}": {
                "organizations:test-feature": True,
                "organizations:disabled-feature": False,
            }
        }

        result = serialize(organization, user)
        assert "test-feature" in result["features"]
        assert "disabled-feature" not in result["features"]


class DetailedOrganizationSerializerTest(TestCase):
    def test_detailed(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)
        acc = access.from_user(user, organization)

        serializer = DetailedOrganizationSerializer()
        result = serialize(organization, user, serializer, access=acc)

        assert result["id"] == str(organization.id)
        assert result["role"] == "owner"
        assert result["access"] == settings.SENTRY_SCOPES
        assert result["relayPiiConfig"] is None
