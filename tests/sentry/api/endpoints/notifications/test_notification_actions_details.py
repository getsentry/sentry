from unittest.mock import MagicMock, patch

import responses
from rest_framework import serializers, status

from sentry.api.serializers.base import serialize
from sentry.integrations.pagerduty.utils import add_service
from sentry.models.notificationaction import (
    ActionRegistration,
    ActionService,
    ActionTarget,
    ActionTrigger,
    NotificationAction,
    NotificationActionProject,
)
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.slack import install_slack
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.utils import json


@region_silo_test
class NotificationActionsDetailsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-notification-actions-details"

    def setUp(self):
        self.user = self.create_user("summoner@rift.io")
        self.organization = self.create_organization(name="league", owner=self.user)
        self.other_organization = self.create_organization(name="wild-rift", owner=self.user)
        self.team = self.create_team(name="games", organization=self.organization)
        self.projects = [
            self.create_project(name="bilgewater", organization=self.organization),
            self.create_project(name="demacia", organization=self.organization),
        ]
        self.notif_action = self.create_notification_action(
            organization=self.organization, projects=self.projects
        )
        self.base_data = {
            "serviceType": "email",
            "triggerType": "audit-log",
            "targetType": "specific",
            "targetDisplay": "@pyke",
            "targetIdentifier": "555",
        }
        self.mock_register = lambda data: NotificationAction.register_action(
            trigger_type=ActionTrigger.get_value(data["triggerType"]),
            service_type=ActionService.get_value(data["serviceType"]),
            target_type=ActionTarget.get_value(data["targetType"]),
        )
        self.login_as(user=self.user)

    def test_requires_organization_access(self):
        for method in ["GET", "PUT", "DELETE"]:
            self.get_error_response(
                self.other_organization.slug,
                self.notif_action.id,
                status_code=status.HTTP_404_NOT_FOUND,
                method=method,
            )

    def test_requires_project_access(self):
        """
        This only tests 'GET' since members aren't granted project:write scopes so they 403 before
        reaching any endpoint logic (for PUT/DELETE)
        """
        self.organization.flags = 0
        self.organization.save()
        action = self.create_notification_action(
            organization=self.organization,
            projects=[self.create_project(organization=self.organization)],
        )
        user = self.create_user("ruinedking@rift.com")
        self.create_member(user=user, organization=self.organization, role="admin")
        self.login_as(user=user)

        self.get_error_response(
            self.organization.slug,
            action.id,
            status_code=status.HTTP_404_NOT_FOUND,
        )

    def test_get_simple(self):
        response = self.get_success_response(
            self.organization.slug, self.notif_action.id, status_code=status.HTTP_200_OK
        )
        assert response.data == serialize(self.notif_action)

    def test_put_missing_action(self):
        self.get_error_response(
            self.organization.slug,
            -1,
            status_code=status.HTTP_404_NOT_FOUND,
            method="PUT",
        )

    def test_put_missing_fields(self):
        required_fields = ["serviceType", "triggerType"]
        response = self.get_error_response(
            self.organization.slug,
            self.notif_action.id,
            status_code=status.HTTP_400_BAD_REQUEST,
            method="PUT",
        )
        for field in required_fields:
            assert field in response.data

    def test_put_invalid_types(self):
        invalid_types = {
            "serviceType": "hexgate",
            "triggerType": "ruination",
            "targetType": "igl",
        }
        for type_key, invalid_value in invalid_types.items():
            data = {**self.base_data}
            data[type_key] = invalid_value
            response = self.get_error_response(
                self.organization.slug,
                self.notif_action.id,
                status_code=status.HTTP_400_BAD_REQUEST,
                method="PUT",
                **data,
            )
            assert type_key in response.data

    def test_put_invalid_integration(self):
        data = {**self.base_data}
        # Unknown integration
        data["integrationId"] = -1
        response = self.get_error_response(
            self.organization.slug,
            self.notif_action.id,
            status_code=status.HTTP_400_BAD_REQUEST,
            method="PUT",
            **data,
        )
        assert "integrationId" in response.data

        # Integration from another organization
        integration = self.create_integration(
            organization=self.other_organization, external_id="m0b1l3"
        )
        data["integrationId"] = integration.id
        response = self.get_error_response(
            self.organization.slug,
            self.notif_action.id,
            status_code=status.HTTP_400_BAD_REQUEST,
            method="PUT",
            **data,
        )
        assert "integrationId" in response.data

    def test_put_invalid_projects(self):
        data = {**self.base_data}
        # Unknown project
        data["projects"] = ["piltover"]
        response = self.get_error_response(
            self.organization.slug,
            self.notif_action.id,
            status_code=status.HTTP_400_BAD_REQUEST,
            method="PUT",
            **data,
        )
        assert "projects" in response.data
        # Project from another organization
        project = self.create_project(name="zaun", organization=self.other_organization)
        data["projects"] = [project.slug]
        response = self.get_error_response(
            self.organization.slug,
            self.notif_action.id,
            status_code=status.HTTP_400_BAD_REQUEST,
            method="PUT",
            **data,
        )
        assert "projects" in response.data

    def test_put_no_project_access(self):
        user = self.create_user("tft@rift.com")
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)
        data = {
            **self.base_data,
            "projects": [p.slug for p in self.projects],
        }
        self.get_error_response(
            self.organization.slug,
            self.notif_action.id,
            status_code=status.HTTP_403_FORBIDDEN,
            method="PUT",
            **data,
        )

    @patch.dict(NotificationAction._registry, {})
    def test_put_raises_validation_from_registry(self):
        error_message = "oops-missed-cannon"

        class MockActionRegistration(ActionRegistration):
            validate_action = MagicMock(side_effect=serializers.ValidationError(error_message))

        registration = MockActionRegistration
        NotificationAction.register_action(
            trigger_type=ActionTrigger.get_value(self.base_data["triggerType"]),
            service_type=ActionService.get_value(self.base_data["serviceType"]),
            target_type=ActionTarget.get_value(self.base_data["targetType"]),
        )(registration)

        response = self.get_error_response(
            self.organization.slug,
            self.notif_action.id,
            status_code=status.HTTP_400_BAD_REQUEST,
            method="PUT",
            **self.base_data,
        )
        assert error_message in str(response.data)

    @patch.dict(NotificationAction._registry, {})
    @responses.activate
    def test_put_with_slack_validation(self):
        class MockActionRegistration(ActionRegistration):
            pass

        channel_name = "journal"
        channel_id = "CABC123"

        integration = install_slack(organization=self.organization)
        data = {
            "triggerType": "audit-log",
            "targetType": "specific",
            "serviceType": "slack",
            "integrationId": integration.id,
            "targetDisplay": f"#{channel_name}",
        }

        self.mock_register(data)(MockActionRegistration)

        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.scheduleMessage",
            status=200,
            content_type="application/json",
            body=json.dumps(
                {"ok": "true", "channel": channel_id, "scheduled_message_id": "Q1298393284"}
            ),
        )
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.deleteScheduledMessage",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": True}),
        )

        response = self.get_success_response(
            self.organization.slug,
            self.notif_action.id,
            status_code=status.HTTP_202_ACCEPTED,
            method="PUT",
            **data,
        )
        assert response.data["targetIdentifier"] == channel_id

    @patch.dict(NotificationAction._registry, {})
    def test_put_with_pagerduty_validation(self):
        class MockActionRegistration(ActionRegistration):
            pass

        service_name = "palace"

        integration = self.create_integration(
            organization=self.organization, external_id="pd-id", provider="pagerduty", name="dream"
        )
        second_integration = self.create_integration(
            organization=self.organization, external_id="pd-id-2", provider="pagerduty", name="nail"
        )

        data = {
            "triggerType": "audit-log",
            "targetType": "specific",
            "serviceType": "pagerduty",
            "integrationId": integration.id,
            "targetDisplay": "incorrect_service_name",
        }

        self.mock_register(data)(MockActionRegistration)

        # Didn't provide a targetIdentifier key
        response = self.get_error_response(
            self.organization.slug,
            self.notif_action.id,
            status_code=status.HTTP_400_BAD_REQUEST,
            method="PUT",
            **data,
        )
        assert "Did not recieve PagerDuty service id" in str(response.data["targetIdentifier"])
        with assume_test_silo_mode(SiloMode.CONTROL):
            org_integration = second_integration.organizationintegration_set.first()
            service = add_service(
                org_integration,
                service_name=service_name,
                integration_key="abc",
            )
        data["targetIdentifier"] = service["id"]
        response = self.get_error_response(
            self.organization.slug,
            self.notif_action.id,
            status_code=status.HTTP_400_BAD_REQUEST,
            method="PUT",
            **data,
        )
        assert "ensure Sentry has access" in str(response.data["targetIdentifier"])
        with assume_test_silo_mode(SiloMode.CONTROL):
            org_integration = integration.organizationintegration_set.first()
            service = add_service(
                org_integration,
                service_name=service_name,
                integration_key="def",
            )
        data["targetIdentifier"] = service["id"]
        response = self.get_success_response(
            self.organization.slug,
            self.notif_action.id,
            status_code=status.HTTP_202_ACCEPTED,
            method="PUT",
            **data,
        )
        assert response.data["targetIdentifier"] == service["id"]
        assert response.data["targetDisplay"] == service["service_name"]

    @patch.dict(NotificationAction._registry, {})
    def test_put_simple(self):
        class MockActionRegistration(ActionRegistration):
            validate_action = MagicMock()

        self.mock_register(self.base_data)(MockActionRegistration)

        data = {**self.base_data}
        assert not MockActionRegistration.validate_action.called
        response = self.get_success_response(
            self.organization.slug,
            self.notif_action.id,
            status_code=status.HTTP_202_ACCEPTED,
            method="PUT",
            **data,
        )
        # Response contains input data
        assert data.items() <= response.data.items()
        # Database reflects changes
        assert MockActionRegistration.validate_action.called
        self.notif_action.refresh_from_db()
        assert response.data == serialize(self.notif_action)
        # Relation table has been updated
        assert not NotificationActionProject.objects.filter(action_id=self.notif_action.id).exists()

    @patch.dict(NotificationAction._registry, {})
    def test_put_org_member(self):
        user = self.create_user()
        self.create_member(organization=self.organization, user=user, teams=[self.team])
        self.login_as(user)

        data = {**self.base_data}
        self.get_error_response(
            self.organization.slug,
            self.notif_action.id,
            status_code=status.HTTP_403_FORBIDDEN,
            method="PUT",
            **data,
        )

    @patch.dict(NotificationAction._registry, {})
    def test_put_org_admin(self):
        user = self.create_user()
        self.create_member(organization=self.organization, user=user, role="admin")
        self.login_as(user)

        self.test_put_simple()

    @patch.dict(NotificationAction._registry, {})
    def test_put_team_admin(self):
        user = self.create_user()
        member = self.create_member(organization=self.organization, user=user, role="member")
        OrganizationMemberTeam.objects.create(
            team=self.team, organizationmember=member, role="admin"
        )
        self.login_as(user)

        self.test_put_simple()

    def test_delete_invalid_action(self):
        self.get_error_response(
            self.organization.slug,
            -1,
            status_code=status.HTTP_404_NOT_FOUND,
            method="DELETE",
        )
        action = self.create_notification_action(organization=self.other_organization)
        self.get_error_response(
            self.organization.slug,
            action.id,
            status_code=status.HTTP_404_NOT_FOUND,
            method="DELETE",
        )
        assert NotificationAction.objects.filter(id=action.id).exists()

    def test_delete_simple(self):
        assert NotificationAction.objects.filter(id=self.notif_action.id).exists()
        self.get_success_response(
            self.organization.slug,
            self.notif_action.id,
            status_code=status.HTTP_204_NO_CONTENT,
            method="DELETE",
        )
        assert not NotificationAction.objects.filter(id=self.notif_action.id).exists()

    def test_delete_manager(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.organization, role="manager")
        self.login_as(user)

        self.test_delete_simple()

    def test_delete_org_member(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)

        self.get_error_response(
            self.organization.slug,
            self.notif_action.id,
            status_code=status.HTTP_403_FORBIDDEN,
            method="DELETE",
        )

    def test_delete_org_admin(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.organization, role="admin")
        self.login_as(user)

        self.test_delete_simple()

    def test_delete_team_admin(self):
        user = self.create_user()
        member = self.create_member(organization=self.organization, user=user, role="member")
        OrganizationMemberTeam.objects.create(
            team=self.team, organizationmember=member, role="admin"
        )
        self.login_as(user)

        self.test_delete_simple()
