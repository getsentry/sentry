from sentry.models import NotificationSetting, OrganizationMember
from sentry.notifications.notifications.organization_request import OrganizationRequestNotification
from sentry.notifications.notifications.strategies.role_based_recipient_strategy import (
    RoleBasedRecipientStrategy,
)
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.testutils import TestCase
from sentry.types.integrations import ExternalProviders


class DummyRoleBasedRecipientStrategy(RoleBasedRecipientStrategy):
    def determine_member_recipients(self):
        return OrganizationMember.objects.filter(organization=self.organization)


class DummyRequestNotification(OrganizationRequestNotification):
    RoleBasedRecipientStrategyClass = DummyRoleBasedRecipientStrategy


class GetParticipantsTest(TestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.user1 = self.create_user()
        self.user2 = self.create_user()
        self.member1 = self.create_member(user=self.user1, organization=self.organization)
        self.member2 = self.create_member(user=self.user2, organization=self.organization)

    def test_default_to_slack(self):
        notification = DummyRequestNotification(self.organization, self.user)

        assert notification.get_participants() == {
            ExternalProviders.EMAIL: {self.user1, self.user2},
            ExternalProviders.SLACK: {self.user1, self.user2},
        }

    def test_turn_off_settings(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.APPROVAL,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user1,
        )

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.APPROVAL,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user2,
        )

        notification = DummyRequestNotification(self.organization, self.user)

        assert notification.get_participants() == {
            ExternalProviders.EMAIL: {self.user1, self.user2},
            ExternalProviders.SLACK: {self.user1, self.user2},
        }
