from sentry.constants import ObjectStatus, SentryAppStatus
from sentry.incidents.endpoints.organization_alert_rule_available_action_index import (
    build_action_response,
)
from sentry.incidents.models import AlertRuleTriggerAction
from sentry.models import Integration, PagerDutyService
from sentry.testutils import APITestCase

SERVICES = [
    {
        "type": "service",
        "integration_key": "PND4F9",
        "service_id": "123",
        "service_name": "hellboi",
    }
]


class OrganizationAlertRuleAvailableActionIndexEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-alert-rule-available-actions"
    email = AlertRuleTriggerAction.get_registered_type(AlertRuleTriggerAction.Type.EMAIL)
    slack = AlertRuleTriggerAction.get_registered_type(AlertRuleTriggerAction.Type.SLACK)
    sentry_app = AlertRuleTriggerAction.get_registered_type(AlertRuleTriggerAction.Type.SENTRY_APP)
    pagerduty = AlertRuleTriggerAction.get_registered_type(AlertRuleTriggerAction.Type.PAGERDUTY)

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def install_new_sentry_app(self, name, **kwargs):
        kwargs.update(
            name=name, organization=self.organization, is_alertable=True, verify_install=False
        )
        sentry_app = self.create_sentry_app(**kwargs)
        installation = self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )
        return installation

    def test_build_action_response_email(self):
        data = build_action_response(self.email)

        assert data["type"] == "email"
        assert sorted(data["allowedTargetTypes"]) == ["team", "user"]

    def test_build_action_response_slack(self):
        data = build_action_response(self.slack)

        assert data["type"] == "slack"
        assert data["allowedTargetTypes"] == ["specific"]

    def test_build_action_response_pagerduty(self):
        service_name = SERVICES[0]["service_name"]
        integration = Integration.objects.create(
            provider="pagerduty",
            name="Example PagerDuty",
            external_id="example-pagerduty",
            metadata={"services": SERVICES},
        )
        integration.add_organization(self.organization, self.user)
        service = PagerDutyService.objects.create(
            service_name=service_name,
            integration_key=SERVICES[0]["integration_key"],
            organization_integration=integration.organizationintegration_set.first(),
        )

        data = build_action_response(
            self.pagerduty, integration=integration, organization=self.organization
        )

        assert data["type"] == "pagerduty"
        assert data["allowedTargetTypes"] == ["specific"]
        assert data["options"] == [{"value": service.id, "label": service_name}]

    def test_build_action_response_sentry_app(self):
        installation = self.install_new_sentry_app("foo")

        data = build_action_response(self.sentry_app, sentry_app_installation=installation)

        assert data["type"] == "sentry_app"
        assert data["allowedTargetTypes"] == ["sentry_app"]
        assert data["status"] == SentryAppStatus.UNPUBLISHED_STR

    def test_no_integrations(self):
        with self.feature("organizations:incidents"):
            response = self.get_success_response(self.organization.slug)

        assert response.data == [build_action_response(self.email)]

    def test_simple(self):
        integration = Integration.objects.create(external_id="1", provider="slack")
        integration.add_organization(self.organization)

        with self.feature("organizations:incidents"):
            response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 2
        assert build_action_response(self.email) in response.data
        assert (
            build_action_response(
                self.slack, integration=integration, organization=self.organization
            )
            in response.data
        )

    def test_duplicate_integrations(self):
        integration = Integration.objects.create(external_id="1", provider="slack", name="slack 1")
        integration.add_organization(self.organization)
        other_integration = Integration.objects.create(
            external_id="2", provider="slack", name="slack 2"
        )
        other_integration.add_organization(self.organization)

        with self.feature("organizations:incidents"):
            response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 3
        assert build_action_response(self.email) in response.data
        assert (
            build_action_response(
                self.slack, integration=integration, organization=self.organization
            )
            in response.data
        )
        assert (
            build_action_response(
                self.slack, integration=other_integration, organization=self.organization
            )
            in response.data
        )

    def test_no_feature(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.get_error_response(self.organization.slug, status_code=404)

    def test_sentry_apps(self):
        installation = self.install_new_sentry_app("foo")

        with self.feature("organizations:incidents"):
            response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 2
        assert build_action_response(self.email) in response.data
        assert (
            build_action_response(self.sentry_app, sentry_app_installation=installation)
            in response.data
        )

    def test_published_sentry_apps(self):
        # Should show up in available actions.
        installation = self.install_new_sentry_app("published", published=True)

        with self.feature("organizations:incidents"):
            response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 2
        assert (
            build_action_response(self.sentry_app, sentry_app_installation=installation)
            in response.data
        )

    def test_no_ticket_actions(self):
        integration = Integration.objects.create(external_id="1", provider="jira")
        integration.add_organization(self.organization)

        with self.feature(["organizations:incidents", "organizations:integrations-ticket-rules"]):
            response = self.get_success_response(self.organization.slug)

        # There should be no ticket actions for Metric Alerts.
        assert len(response.data) == 1
        assert build_action_response(self.email) in response.data

    def test_integration_disabled(self):
        integration = Integration.objects.create(
            external_id="1", provider="slack", status=ObjectStatus.DISABLED
        )
        integration.add_organization(self.organization)

        with self.feature("organizations:incidents"):
            response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 1
        assert build_action_response(self.email) in response.data

    def test_org_integration_disabled(self):
        integration = Integration.objects.create(external_id="1", provider="slack")
        org_integration = integration.add_organization(self.organization)
        org_integration.update(status=ObjectStatus.DISABLED)

        with self.feature("organizations:incidents"):
            response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 1
        assert build_action_response(self.email) in response.data
