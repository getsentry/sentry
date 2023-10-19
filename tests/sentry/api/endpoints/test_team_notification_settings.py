from rest_framework import status

from sentry.models.notificationsetting import NotificationSetting
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.services.hybrid_cloud.notifications import notifications_service
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.types.integrations import ExternalProviders


class TeamNotificationSettingsTestBase(APITestCase):
    endpoint = "sentry-api-0-team-notification-settings"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


@region_silo_test()
class TeamNotificationSettingsGetTest(TeamNotificationSettingsTestBase):
    def test_simple(self):
        _ = self.project  # HACK to force creation.

        notifications_service.update_settings(
            external_provider=ExternalProviders.EMAIL,
            notification_type=NotificationSettingTypes.ISSUE_ALERTS,
            setting_option=NotificationSettingOptionValues.ALWAYS,
            actor=RpcActor.from_object(self.team),
            project_id=self.project.id,
            organization_id_for_team=self.organization.id,
        )
        notifications_service.update_settings(
            external_provider=ExternalProviders.EMAIL,
            notification_type=NotificationSettingTypes.DEPLOY,
            setting_option=NotificationSettingOptionValues.NEVER,
            actor=RpcActor.from_object(self.team),
            organization_id=self.organization.id,
            organization_id_for_team=self.organization.id,
        )
        notifications_service.update_settings(
            external_provider=ExternalProviders.SLACK,
            notification_type=NotificationSettingTypes.WORKFLOW,
            setting_option=NotificationSettingOptionValues.DEFAULT,
            actor=RpcActor.from_object(self.team),
            project_id=self.project.id,
            organization_id_for_team=self.organization.id,
        )

        response = self.get_success_response(
            self.organization.slug, self.team.slug, v2="serializer"
        )

        # Spot check.
        assert response.data["alerts"]["project"][self.project.id]["email"] == "always"
        assert response.data["deploy"]["organization"][self.organization.id]["email"] == "never"
        assert not response.data["workflow"]

    def test_type_querystring(self):
        notifications_service.update_settings(
            external_provider=ExternalProviders.EMAIL,
            notification_type=NotificationSettingTypes.ISSUE_ALERTS,
            setting_option=NotificationSettingOptionValues.ALWAYS,
            actor=RpcActor.from_object(self.team),
            organization_id_for_team=self.organization.id,
        )
        notifications_service.update_settings(
            external_provider=ExternalProviders.SLACK,
            notification_type=NotificationSettingTypes.WORKFLOW,
            setting_option=NotificationSettingOptionValues.ALWAYS,
            actor=RpcActor.from_object(self.team),
            organization_id_for_team=self.organization.id,
        )
        response = self.get_success_response(
            self.organization.slug,
            self.team.slug,
            qs_params={"type": "workflow", "v2": "serializer"},
        )

        assert "alerts" not in response.data
        assert "workflow" in response.data

    def test_invalid_querystring(self):
        self.get_error_response(
            self.organization.slug,
            self.team.slug,
            qs_params={"type": "invalid"},
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    def test_invalid_team_slug(self):
        self.get_error_response(
            self.organization.slug, "invalid", status_code=status.HTTP_404_NOT_FOUND
        )

    def test_wrong_team_slug(self):
        other_org = self.create_organization()
        other_team = self.create_team(organization=other_org, name="Tesla Motors")

        self.get_error_response(
            other_org.slug, other_team.slug, status_code=status.HTTP_403_FORBIDDEN
        )


@region_silo_test()
class TeamNotificationSettingsTest(TeamNotificationSettingsTestBase):
    method = "put"

    def test_simple(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert (
                NotificationSetting.objects.get_settings(
                    provider=ExternalProviders.SLACK,
                    type=NotificationSettingTypes.ISSUE_ALERTS,
                    team_id=self.team.id,
                    project=self.project,
                )
                == NotificationSettingOptionValues.DEFAULT
            )

        self.get_success_response(
            self.organization.slug,
            self.team.slug,
            alerts={"project": {self.project.id: {"email": "always", "slack": "always"}}},
            status_code=status.HTTP_204_NO_CONTENT,
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert (
                NotificationSetting.objects.get_settings(
                    provider=ExternalProviders.SLACK,
                    type=NotificationSettingTypes.ISSUE_ALERTS,
                    team_id=self.team.id,
                    project=self.project,
                )
                == NotificationSettingOptionValues.ALWAYS
            )

    def test_empty_payload(self):
        self.get_error_response(
            self.organization.slug,
            self.team.slug,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    def test_invalid_payload(self):
        self.get_error_response(
            self.organization.slug,
            self.team.slug,
            invalid=1,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
