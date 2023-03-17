from rest_framework import status

from sentry.api.serializers.base import serialize
from sentry.models.notificationaction import NotificationAction, NotificationActionProject
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test

NOTIFICATION_ACTION_FEATURE = ["organizations:notification-actions"]


@region_silo_test(stable=True)
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
            "serviceType": "slack",
            "triggerType": "audit-log",
            "targetType": "specific",
            "targetDisplay": "@pyke",
            "targetIdentifier": "555",
        }
        self.login_as(user=self.user)

    def test_requires_feature(self):
        for method in ["GET", "PUT", "DELETE"]:
            self.get_error_response(
                self.organization.slug,
                self.notif_action.id,
                status_code=status.HTTP_404_NOT_FOUND,
                method=method,
            )

    def test_requires_organization_access(self):
        with self.feature(NOTIFICATION_ACTION_FEATURE):
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

        with self.feature(NOTIFICATION_ACTION_FEATURE):
            self.get_error_response(
                self.organization.slug,
                action.id,
                status_code=status.HTTP_404_NOT_FOUND,
            )

    def test_get_simple(self):
        with self.feature(NOTIFICATION_ACTION_FEATURE):
            response = self.get_success_response(
                self.organization.slug, self.notif_action.id, status_code=status.HTTP_200_OK
            )
            assert response.data == serialize(self.notif_action)

    def test_put_missing_action(self):
        with self.feature(NOTIFICATION_ACTION_FEATURE):
            self.get_error_response(
                self.organization.slug,
                -1,
                status_code=status.HTTP_404_NOT_FOUND,
                method="PUT",
            )

    def test_put_missing_fields(self):
        required_fields = self.base_data.keys()
        with self.feature(NOTIFICATION_ACTION_FEATURE):
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
        with self.feature(NOTIFICATION_ACTION_FEATURE):
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
        with self.feature(NOTIFICATION_ACTION_FEATURE):
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
        with self.feature(NOTIFICATION_ACTION_FEATURE):
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
        with self.feature(NOTIFICATION_ACTION_FEATURE):
            self.get_error_response(
                self.organization.slug,
                self.notif_action.id,
                status_code=status.HTTP_403_FORBIDDEN,
                method="PUT",
                **data,
            )

    def test_put_simple(self):
        data = {**self.base_data}
        with self.feature(NOTIFICATION_ACTION_FEATURE):
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
            self.notif_action.refresh_from_db()
            assert response.data == serialize(self.notif_action)
            # Relation table has been updated
            assert not NotificationActionProject.objects.filter(
                action_id=self.notif_action.id
            ).exists()

    def test_delete_invalid_action(self):
        with self.feature(NOTIFICATION_ACTION_FEATURE):
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
        with self.feature(NOTIFICATION_ACTION_FEATURE):
            assert NotificationAction.objects.filter(id=self.notif_action.id).exists()
            self.get_success_response(
                self.organization.slug,
                self.notif_action.id,
                status_code=status.HTTP_204_NO_CONTENT,
                method="DELETE",
            )
            assert not NotificationAction.objects.filter(id=self.notif_action.id).exists()
