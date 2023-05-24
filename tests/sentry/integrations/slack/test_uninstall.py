from typing import Optional

from sentry.constants import ObjectStatus
from sentry.models import (
    Integration,
    NotificationSetting,
    OrganizationIntegration,
    Project,
    ScheduledDeletion,
    User,
)
from sentry.notifications.helpers import NOTIFICATION_SETTING_DEFAULTS
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.testutils import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.integrations import ExternalProviders


@control_silo_test
class SlackUninstallTest(APITestCase):
    """TODO(mgaeta): Extract the endpoint's DELETE logic to a helper and use it instead of API."""

    endpoint = "sentry-api-0-organization-integration-details"
    method = "delete"

    def setUp(self) -> None:
        self.integration = self.create_slack_integration(self.organization)
        self.login_as(self.user)

    def uninstall(self) -> None:
        org_integration = OrganizationIntegration.objects.get(
            integration=self.integration, organization_id=self.organization.id
        )

        with self.tasks():
            self.get_success_response(self.organization.slug, self.integration.id)

        assert Integration.objects.filter(id=self.integration.id).exists()

        assert not OrganizationIntegration.objects.filter(
            integration=self.integration,
            organization_id=self.organization.id,
            status=ObjectStatus.ACTIVE,
        ).exists()
        assert ScheduledDeletion.objects.filter(
            model_name="OrganizationIntegration", object_id=org_integration.id
        ).exists()

    def get_setting(
        self, user: User, provider: ExternalProviders, parent: Optional[Project] = None
    ) -> NotificationSettingOptionValues:
        type = NotificationSettingTypes.ISSUE_ALERTS
        parent_specific_setting = NotificationSetting.objects.get_settings(
            provider=provider, type=type, actor=RpcActor.from_orm_user(user), project=parent
        )
        if parent_specific_setting != NotificationSettingOptionValues.DEFAULT:
            return parent_specific_setting
        parent_independent_setting = NotificationSetting.objects.get_settings(
            provider=provider, type=type, actor=RpcActor.from_orm_user(user)
        )
        if parent_independent_setting != NotificationSettingOptionValues.DEFAULT:
            return parent_independent_setting

        return NOTIFICATION_SETTING_DEFAULTS[provider][type]

    def assert_settings(
        self, provider: ExternalProviders, value: NotificationSettingOptionValues
    ) -> None:
        assert self.get_setting(self.user, provider) == value
        assert self.get_setting(self.user, provider, parent=self.project) == value

    def set_setting(
        self, provider: ExternalProviders, value: NotificationSettingOptionValues
    ) -> None:
        type = NotificationSettingTypes.ISSUE_ALERTS
        NotificationSetting.objects.update_settings(provider, type, value, user=self.user)
        NotificationSetting.objects.update_settings(
            provider, type, value, user=self.user, project=self.project
        )

    def test_uninstall_email_only(self):
        self.uninstall()

        self.assert_settings(ExternalProviders.EMAIL, NotificationSettingOptionValues.ALWAYS)
        self.assert_settings(ExternalProviders.SLACK, NotificationSettingOptionValues.NEVER)

    def test_uninstall_slack_and_email(self):
        self.set_setting(ExternalProviders.SLACK, NotificationSettingOptionValues.ALWAYS)

        self.uninstall()

        self.assert_settings(ExternalProviders.EMAIL, NotificationSettingOptionValues.ALWAYS)
        self.assert_settings(ExternalProviders.SLACK, NotificationSettingOptionValues.NEVER)

    def test_uninstall_slack_only(self):
        self.set_setting(ExternalProviders.EMAIL, NotificationSettingOptionValues.NEVER)
        self.set_setting(ExternalProviders.SLACK, NotificationSettingOptionValues.ALWAYS)

        self.uninstall()

        self.assert_settings(ExternalProviders.EMAIL, NotificationSettingOptionValues.NEVER)
        self.assert_settings(ExternalProviders.SLACK, NotificationSettingOptionValues.NEVER)

    def test_uninstall_generates_settings_with_userid(self):
        self.uninstall()

        self.assert_settings(ExternalProviders.SLACK, NotificationSettingOptionValues.NEVER)
        # Ensure uninstall sets user_id.
        settings = NotificationSetting.objects.find_settings(
            provider=ExternalProviders.SLACK,
            type=NotificationSettingTypes.ISSUE_ALERTS,
            user=self.user,
        )
        assert settings[0].user_id == self.user.id

    def test_uninstall_with_multiple_organizations(self):
        organization = self.create_organization(owner=self.user)
        integration = self.create_slack_integration(organization, "TXXXXXXX2")

        self.set_setting(ExternalProviders.EMAIL, NotificationSettingOptionValues.NEVER)
        self.set_setting(ExternalProviders.SLACK, NotificationSettingOptionValues.ALWAYS)

        self.uninstall()

        # No changes to second organization.
        assert Integration.objects.filter(id=integration.id).exists()
        assert OrganizationIntegration.objects.filter(
            integration=integration, organization_id=organization.id
        ).exists()

        self.assert_settings(ExternalProviders.EMAIL, NotificationSettingOptionValues.NEVER)
        self.assert_settings(ExternalProviders.SLACK, NotificationSettingOptionValues.ALWAYS)
