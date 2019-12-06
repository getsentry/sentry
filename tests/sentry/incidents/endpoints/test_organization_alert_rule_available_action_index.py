from __future__ import absolute_import

from sentry.models import Integration
from sentry.testutils import APITestCase


class OrganizationAlertRuleAvailableActionIndexEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-alert-rule-available-actions"

    def setUp(self):
        super(OrganizationAlertRuleAvailableActionIndexEndpointTest, self).setUp()
        self.login_as(self.user)

    def create_integration_response(self, type, integration=None):
        return {
            "type": type,
            "allowedTargetTypes": ["user", "team"] if type == "email" else ["specific"],
            "integrationName": integration.name if integration else None,
            "integrationId": integration.id if integration else None,
        }

    def test_no_integrations(self):
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(self.organization.slug)

        assert resp.data == [self.create_integration_response("email")]

    def test_simple(self):
        integration = Integration.objects.create(external_id="1", provider="slack")
        integration.add_organization(self.organization)

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(self.organization.slug)

        assert resp.data == [
            self.create_integration_response("email"),
            self.create_integration_response("slack", integration),
        ]

    def test_duplicate_integrations(self):
        integration = Integration.objects.create(external_id="1", provider="slack", name="slack 1")
        integration.add_organization(self.organization)
        other_integration = Integration.objects.create(
            external_id="2", provider="slack", name="slack 2"
        )
        other_integration.add_organization(self.organization)

        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(self.organization.slug)

        assert resp.data == [
            self.create_integration_response("email"),
            self.create_integration_response("slack", integration),
            self.create_integration_response("slack", other_integration),
        ]

    def test_no_feature(self):
        self.create_team(organization=self.organization, members=[self.user])
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 404
