from collections.abc import Callable, Mapping, MutableMapping
from typing import Any, TypedDict, TypeVar
from unittest.mock import MagicMock, patch

import responses
from rest_framework import serializers, status

from sentry.api.serializers.base import serialize
from sentry.integrations.pagerduty.utils import add_service
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.notifications.models.notificationaction import (
    ActionRegistration,
    ActionService,
    ActionTarget,
    ActionTrigger,
    NotificationAction,
    NotificationActionProject,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.slack import install_slack
from sentry.testutils.silo import assume_test_silo_mode
from tests.sentry.integrations.slack.utils.test_mock_slack_response import mock_slack_response

ActionRegistrationT = TypeVar("ActionRegistrationT", bound=ActionRegistration)


class _Query(TypedDict, total=False):
    triggerType: str
    project: int


class _QueryResult(TypedDict):
    query: _Query
    result: set[NotificationAction]


class NotificationActionsIndexEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-notification-actions"

    @patch.dict(NotificationAction._registry, {})
    def setUp(self):
        self.user = self.create_user("thepaleking@hk.com")
        self.organization = self.create_organization(name="hallownest", owner=self.user)
        self.other_organization = self.create_organization(name="pharloom", owner=self.user)
        self.team = self.create_team(
            name="pale beings", organization=self.organization, members=[self.user]
        )
        self.projects = [
            self.create_project(name="greenpath", organization=self.organization),
            self.create_project(name="dirtmouth", organization=self.organization),
        ]
        self.base_data: MutableMapping[str, Any] = {
            "serviceType": "email",
            "triggerType": "audit-log",
            "targetType": "specific",
            "targetDisplay": "@hollowknight",
            "targetIdentifier": "THK",
        }

        def mock_register(
            data: MutableMapping[str, Any]
        ) -> Callable[[type[ActionRegistrationT]], type[ActionRegistrationT]]:
            triggerType = ActionTrigger.get_value(data["triggerType"])
            serviceType = ActionService.get_value(data["serviceType"])
            targetType = ActionTarget.get_value(data["targetType"])

            assert triggerType is not None, "triggerType must exist"
            assert serviceType is not None, "serviceType must exist"
            assert targetType is not None, "targetType must exist"

            return NotificationAction.register_action(
                trigger_type=triggerType, service_type=serviceType, target_type=targetType
            )

        self.mock_register = mock_register
        self.login_as(user=self.user)

    def test_get_simple(self):
        notif_actions = [
            self.create_notification_action(organization=self.organization),
            self.create_notification_action(organization=self.organization),
        ]
        other_notif_action = self.create_notification_action(organization=self.other_organization)

        response = self.get_success_response(
            self.organization.slug,
            status_code=status.HTTP_200_OK,
        )
        assert len(response.data) == len(notif_actions)
        assert serialize(other_notif_action) not in response.data
        for action in notif_actions:
            assert serialize(action) in response.data

    @patch.object(
        NotificationAction,
        "get_trigger_types",
        return_value=[(0, "teacher"), (1, "watcher"), (2, "beast")],
    )
    def test_get_with_queries(self, mock_trigger_types):
        project = self.create_project(name="deepnest", organization=self.organization)
        no_team_project = self.create_project(
            name="waterways", organization=self.organization, teams=[]
        )

        na1 = self.create_notification_action(
            organization=self.organization,
            projects=self.projects,
            trigger_type=0,
        )
        na2 = self.create_notification_action(
            organization=self.organization,
            projects=[project],
            trigger_type=0,
        )
        na3 = self.create_notification_action(
            organization=self.organization,
            projects=[project, *self.projects],
            trigger_type=1,
        )
        na4 = self.create_notification_action(
            organization=self.organization,
            trigger_type=0,
        )
        na5 = self.create_notification_action(
            organization=self.organization,
            projects=[no_team_project],
            trigger_type=1,
        )

        query_data: Mapping[str, _QueryResult] = {
            "checks projects by default": {"query": {}, "result": {na1, na2, na3, na4}},
            "regular project": {
                "query": {"project": project.id},
                "result": {na2, na3},
            },
            "regular trigger": {
                "query": {"triggerType": "teacher"},
                "result": {na1, na2, na4},
            },
            "using both": {
                "query": {"project": project.id, "triggerType": "teacher"},
                "result": {na2},
            },
            "empty result": {
                "query": {"triggerType": "beast"},
                "result": set(),
            },
            "not member": {"query": {"triggerType": "watcher"}, "result": {na3}},
            "not member but has access": {
                "query": {"project": -1, "triggerType": "watcher"},
                "result": {na3, na5},
            },
        }

        for data in query_data.values():
            response = self.get_success_response(
                self.organization.slug,
                status_code=status.HTTP_200_OK,
                qs_params=data["query"],
            )
            assert len(response.data) == len(data["result"])
            for action in data["result"]:
                assert serialize(action) in response.data

    def test_post_missing_fields(self):
        required_fields = ["serviceType", "triggerType"]
        response = self.get_error_response(
            self.organization.slug,
            status_code=status.HTTP_400_BAD_REQUEST,
            method="POST",
        )
        for field in required_fields:
            assert field in response.data

    def test_post_invalid_types(self):
        invalid_types = {
            "serviceType": "stag",
            "triggerType": "ascension",
            "targetType": "shade",
        }

        for type_key, invalid_value in invalid_types.items():
            data = {**self.base_data}
            data[type_key] = invalid_value
            response = self.get_error_response(
                self.organization.slug,
                status_code=status.HTTP_400_BAD_REQUEST,
                method="POST",
                **data,
            )
            assert type_key in response.data

    def test_post_invalid_integration(self):
        data = {**self.base_data}

        # Unknown integration
        data["integrationId"] = -1
        response = self.get_error_response(
            self.organization.slug,
            status_code=status.HTTP_400_BAD_REQUEST,
            method="POST",
            **data,
        )
        assert "integrationId" in response.data

        # Integration from another organization
        integration = self.create_integration(
            organization=self.other_organization, external_id="sp1d3r"
        )
        data["integrationId"] = integration.id
        response = self.get_error_response(
            self.organization.slug,
            status_code=status.HTTP_400_BAD_REQUEST,
            method="POST",
            **data,
        )
        assert "integrationId" in response.data

    def test_post_invalid_projects(self):
        data = {**self.base_data}

        # Unknown project
        data["projects"] = ["deep nest"]
        response = self.get_error_response(
            self.organization.slug,
            status_code=status.HTTP_400_BAD_REQUEST,
            method="POST",
            **data,
        )
        assert "projects" in response.data
        # Project from another organization
        project = self.create_project(name="citadel", organization=self.other_organization)
        data["projects"] = [project.slug]
        response = self.get_error_response(
            self.organization.slug,
            status_code=status.HTTP_400_BAD_REQUEST,
            method="POST",
            **data,
        )
        assert "projects" in response.data

    def test_post_no_project_access(self):
        user = self.create_user("hornet@hk.com")
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)
        data = {
            **self.base_data,
            "projects": [p.slug for p in self.projects],
        }
        self.get_error_response(
            self.organization.slug,
            status_code=status.HTTP_403_FORBIDDEN,
            method="POST",
            **data,
        )

    def test_post_org_member(self):
        user = self.create_user("hornet@hk.com")
        self.create_member(user=user, organization=self.organization, teams=[self.team])
        self.login_as(user)
        data = {
            **self.base_data,
            "projects": [p.slug for p in self.projects],
        }
        self.get_error_response(
            self.organization.slug,
            status_code=status.HTTP_403_FORBIDDEN,
            method="POST",
            **data,
        )

    @patch.dict(NotificationAction._registry, {})
    def test_post_raises_validation_from_registry(self):
        error_message = "oops-idea-installed"

        class MockActionRegistration(ActionRegistration):
            validate_action = MagicMock(side_effect=serializers.ValidationError(error_message))

            def fire(self, data: Any) -> None:
                raise NotImplementedError

        self.mock_register(self.base_data)(MockActionRegistration)

        response = self.get_error_response(
            self.organization.slug,
            status_code=status.HTTP_400_BAD_REQUEST,
            method="POST",
            **self.base_data,
        )
        assert error_message in str(response.data)

    @patch.dict(NotificationAction._registry, {})
    @responses.activate
    @mock_slack_response(
        "chat_scheduleMessage",
        body={"ok": True, "channel": "CABC123", "scheduled_message_id": "Q1298393284"},
    )
    @mock_slack_response("chat_deleteScheduledMessage", body={"ok": True})
    def test_post_with_slack_validation(self, mock_delete, mock_schedule):
        class MockActionRegistration(ActionRegistration):
            def fire(self, data: Any) -> None:
                raise NotImplementedError

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

        response = self.get_success_response(
            self.organization.slug,
            status_code=status.HTTP_201_CREATED,
            method="POST",
            **data,
        )
        assert response.data["targetIdentifier"] == channel_id

    @patch.dict(NotificationAction._registry, {})
    def test_post_with_pagerduty_validation(self):
        class MockActionRegistration(ActionRegistration):
            def fire(self, data: Any) -> None:
                raise NotImplementedError

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
            status_code=status.HTTP_400_BAD_REQUEST,
            method="POST",
            **data,
        )
        assert "Did not recieve PagerDuty service id" in str(response.data["targetIdentifier"])
        with assume_test_silo_mode(SiloMode.CONTROL):
            org_integration = second_integration.organizationintegration_set.first()
            assert org_integration is not None, "org integration needs to exist!"
            service = add_service(
                org_integration,
                service_name=service_name,
                integration_key="abc",
            )
        data["targetIdentifier"] = service["id"]
        response = self.get_error_response(
            self.organization.slug,
            status_code=status.HTTP_400_BAD_REQUEST,
            method="POST",
            **data,
        )
        assert "ensure Sentry has access" in str(response.data["targetIdentifier"])
        with assume_test_silo_mode(SiloMode.CONTROL):
            org_integration = integration.organizationintegration_set.first()
            assert org_integration is not None, "org integration needs to exist!"

            service = add_service(
                org_integration,
                service_name=service_name,
                integration_key="def",
            )
        data["targetIdentifier"] = service["id"]
        response = self.get_success_response(
            self.organization.slug,
            status_code=status.HTTP_201_CREATED,
            method="POST",
            **data,
        )
        assert response.data["targetIdentifier"] == service["id"]
        assert response.data["targetDisplay"] == service["service_name"]

    @patch("sentry.notifications.models.notificationaction.ActionRegistration.validate_action")
    @patch.dict(NotificationAction._registry, {})
    def test_post_simple(self, validate_action):

        class MockActionRegistration(ActionRegistration):
            def fire(self, data: Any) -> None:
                raise NotImplementedError

        registration = MockActionRegistration
        self.mock_register(self.base_data)(registration)

        data = {
            **self.base_data,
            "projects": [p.slug for p in self.projects],
        }
        assert not validate_action.called
        response = self.get_success_response(
            self.organization.slug,
            status_code=status.HTTP_201_CREATED,
            method="POST",
            **data,
        )
        # Database reflects changes
        assert validate_action.called
        notif_action = NotificationAction.objects.get(id=response.data.get("id"))
        assert response.data == serialize(notif_action)
        # Relation table has been updated
        notif_action_projects = NotificationActionProject.objects.filter(action_id=notif_action.id)
        assert len(notif_action_projects) == len(self.projects)

    @patch.dict(NotificationAction._registry, {})
    def test_post_org_admin(self):
        user = self.create_user()
        self.create_member(organization=self.organization, user=user, role="admin")
        self.login_as(user)

        self.test_post_simple()

    @patch.dict(NotificationAction._registry, {})
    def test_post_team_admin__success(self):
        user = self.create_user()
        member = self.create_member(organization=self.organization, user=user, role="member")
        OrganizationMemberTeam.objects.create(
            team=self.team, organizationmember=member, role="admin"
        )
        self.login_as(user)

        self.test_post_simple()

    @patch.dict(NotificationAction._registry, {})
    def test_post_team_admin__missing_access(self):
        user = self.create_user()
        member = self.create_member(organization=self.organization, user=user, role="member")
        OrganizationMemberTeam.objects.create(
            team=self.team, organizationmember=member, role="admin"
        )
        self.login_as(user)

        non_admin_project = self.create_project(
            organization=self.organization, teams=[self.create_team()]
        )

        class MockActionRegistration(ActionRegistration):
            validate_action = MagicMock()

            def fire(self, data: Any) -> None:
                raise NotImplementedError

        registration = MockActionRegistration
        self.mock_register(self.base_data)(registration)

        data = {
            **self.base_data,
            "projects": [p.slug for p in self.projects] + [non_admin_project.slug],
        }

        assert not registration.validate_action.called
        response = self.get_error_response(
            self.organization.slug,
            status_code=status.HTTP_403_FORBIDDEN,
            method="POST",
            **data,
        )

        assert (
            "You do not have permission to create notification actions for projects"
            in response.data["detail"]
        )
