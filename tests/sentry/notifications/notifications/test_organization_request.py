from sentry.models import NotificationSetting, OrganizationMember
from sentry.notifications.notifications.organization_request import OrganizationRequestNotification
from sentry.notifications.notifications.strategies.role_based_recipient_strategy import (
    RoleBasedRecipientStrategy,
)
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.services.hybrid_cloud.user import user_service
from sentry.testutils import TestCase
from sentry.types.integrations import ExternalProviders


class DummyRoleBasedRecipientStrategy(RoleBasedRecipientStrategy):
    def determine_member_recipients(self):
        return OrganizationMember.objects.filter(organization=self.organization)


class DummyRequestNotification(OrganizationRequestNotification):
    metrics_key = "dummy"
    template_path = ""
    RoleBasedRecipientStrategyClass = DummyRoleBasedRecipientStrategy


class GetParticipantsTest(TestCase):
    def setUp(self):
        self.user2 = self.create_user()
        self.create_member(user=self.user2, organization=self.organization)

    def test_default_to_slack(self):
        notification = DummyRequestNotification(self.organization, self.user)

        rpc_user = user_service.get_user(self.user.id)
        rpc_user_2 = user_service.get_user(self.user2.id)

        assert notification.get_participants() == {
            ExternalProviders.EMAIL: {rpc_user, rpc_user_2},
            ExternalProviders.SLACK: {rpc_user, rpc_user_2},
        }

    def test_turn_off_settings(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.APPROVAL,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.APPROVAL,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user2,
        )

        notification = DummyRequestNotification(self.organization, self.user)

        rpc_user = user_service.get_user(self.user.id)
        rpc_user_2 = user_service.get_user(self.user2.id)

        assert notification.get_participants() == {
            ExternalProviders.EMAIL: {rpc_user, rpc_user_2},
            ExternalProviders.SLACK: {rpc_user, rpc_user_2},
        }
