from unittest.mock import MagicMock, patch

from rest_framework import serializers, status

from sentry.api.serializers.base import serialize
from sentry.models.notificationaction import (
    ActionRegistration,
    ActionService,
    ActionTarget,
    ActionTrigger,
    NotificationAction,
    NotificationActionProject,
)
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test

NOTIFICATION_ACTION_FEATURE = ["organizations:notification-actions"]


@region_silo_test(stable=True)
class NotificationActionsIndexEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-notification-actions"

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
        self.base_data = {
            "serviceType": "slack",
            "triggerType": "audit-log",
            "targetType": "specific",
            "targetDisplay": "@hollowknight",
            "targetIdentifier": "THK",
        }
        self.login_as(user=self.user)

    def test_requires_feature(self):
        self.get_error_response(self.organization.slug, status_code=status.HTTP_404_NOT_FOUND)
        self.get_error_response(
            self.organization.slug,
            status_code=status.HTTP_404_NOT_FOUND,
            method="POST",
        )

    def test_get_simple(self):
        notif_actions = [
            self.create_notification_action(organization=self.organization),
            self.create_notification_action(organization=self.organization),
        ]
        other_notif_action = self.create_notification_action(organization=self.other_organization)
        with self.feature(NOTIFICATION_ACTION_FEATURE):
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

        query_data = {
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
                "result": {},
            },
            "not member": {"query": {"triggerType": "watcher"}, "result": {na3}},
            "not member but has access": {
                "query": {"project": -1, "triggerType": "watcher"},
                "result": {na3, na5},
            },
        }

        with self.feature(NOTIFICATION_ACTION_FEATURE):
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
        required_fields = self.base_data.keys()
        with self.feature(NOTIFICATION_ACTION_FEATURE):
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
        with self.feature(NOTIFICATION_ACTION_FEATURE):
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
        with self.feature(NOTIFICATION_ACTION_FEATURE):
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
        with self.feature(NOTIFICATION_ACTION_FEATURE):
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
        with self.feature(NOTIFICATION_ACTION_FEATURE):
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

        registration = MockActionRegistration
        NotificationAction.register_action(
            trigger_type=ActionTrigger.get_value(self.base_data["triggerType"]),
            service_type=ActionService.get_value(self.base_data["serviceType"]),
            target_type=ActionTarget.get_value(self.base_data["targetType"]),
        )(registration)

        with self.feature(NOTIFICATION_ACTION_FEATURE):
            response = self.get_error_response(
                self.organization.slug,
                status_code=status.HTTP_400_BAD_REQUEST,
                method="POST",
                **self.base_data,
            )
            assert error_message in str(response.data)

    @patch.dict(NotificationAction._registry, {})
    def test_post_simple(self):
        class MockActionRegistration(ActionRegistration):
            validate_action = MagicMock()

        registration = MockActionRegistration
        NotificationAction.register_action(
            trigger_type=ActionTrigger.get_value(self.base_data["triggerType"]),
            service_type=ActionService.get_value(self.base_data["serviceType"]),
            target_type=ActionTarget.get_value(self.base_data["targetType"]),
        )(registration)

        data = {
            **self.base_data,
            "projects": [p.slug for p in self.projects],
        }
        with self.feature(NOTIFICATION_ACTION_FEATURE):
            assert not registration.validate_action.called
            response = self.get_success_response(
                self.organization.slug,
                status_code=status.HTTP_201_CREATED,
                method="POST",
                **data,
            )
            # Database reflects changes
            assert registration.validate_action.called
            notif_action = NotificationAction.objects.get(id=response.data.get("id"))
            assert response.data == serialize(notif_action)
            # Relation table has been updated
            notif_action_projects = NotificationActionProject.objects.filter(
                action_id=notif_action.id
            )
            assert len(notif_action_projects) == len(self.projects)
