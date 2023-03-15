from unittest.mock import patch

from rest_framework import status

from sentry.api.serializers.base import serialize
from sentry.models.notificationaction import NotificationAction, NotificationActionProject
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test

NOTIFICATION_ACTION_FEATURE = ["organizations:notification-actions"]


@region_silo_test(stable=True)
class NotificationActionsIndexEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-notification-actions"

    def setUp(self):
        self.user = self.create_user("thepale@king.com", is_superuser=True)
        self.organization = self.create_organization(name="hallownest", owner=self.user)
        self.other_organization = self.create_organization(name="pharloom", owner=self.user)
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
        na1 = self.create_notification_action(
            organization=self.organization, projects=self.projects, trigger_type=0
        )
        na2 = self.create_notification_action(
            organization=self.organization, projects=[project], trigger_type=0
        )
        na3 = self.create_notification_action(
            organization=self.organization, projects=[project, *self.projects], trigger_type=1
        )

        project_actions = {na2, na3}
        teacher_actions = {na1, na2}

        with self.feature(NOTIFICATION_ACTION_FEATURE):
            response = self.get_success_response(
                self.organization.slug,
                status_code=status.HTTP_200_OK,
                qs_params={"projectId": project.id},
            )
            assert len(response.data) == len(project_actions)
            for action in project_actions:
                assert serialize(action) in response.data

            response = self.get_success_response(
                self.organization.slug,
                status_code=status.HTTP_200_OK,
                qs_params={"triggerType": "teacher"},
            )
            assert len(response.data) == len(teacher_actions)
            for action in teacher_actions:
                assert serialize(action) in response.data

            response = self.get_success_response(
                self.organization.slug,
                status_code=status.HTTP_200_OK,
                qs_params={"projectId": project.id, "triggerType": "teacher"},
            )
            intersection = project_actions.intersection(teacher_actions)
            assert len(response.data) == len(intersection)
            for action in intersection:
                assert serialize(action) in response.data

            response = self.get_success_response(
                self.organization.slug,
                status_code=status.HTTP_200_OK,
                qs_params={"triggerType": "beast"},
            )
            assert response.data == []

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

    def test_post_simple(self):
        data = {
            **self.base_data,
            "projects": [p.slug for p in self.projects],
        }
        with self.feature(NOTIFICATION_ACTION_FEATURE):
            response = self.get_success_response(
                self.organization.slug,
                status_code=status.HTTP_201_CREATED,
                method="POST",
                **data,
            )
            # Database reflects changes
            notif_action = NotificationAction.objects.get(id=response.data.get("id"))
            assert response.data == serialize(notif_action)
            # Relation table has been updated
            notif_action_projects = NotificationActionProject.objects.filter(
                action_id=notif_action.id
            )
            assert len(notif_action_projects) == len(self.projects)
