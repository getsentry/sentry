from sentry.models import NotificationSetting, OrganizationMember
from sentry.notifications.notifications.organization_request import OrganizationRequestNotification
from sentry.notifications.notifications.strategies.role_based_recipient_strategy import (
    RoleBasedRecipientStrategy,
)
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.integrations import ExternalProviders


class DummyRoleBasedRecipientStrategy(RoleBasedRecipientStrategy):
    def determine_member_recipients(self):
        return OrganizationMember.objects.filter(organization=self.organization)


class DummyRequestNotification(OrganizationRequestNotification):
    metrics_key = "dummy"
    template_path = ""
    RoleBasedRecipientStrategyClass = DummyRoleBasedRecipientStrategy


@control_silo_test
class GetParticipantsTest(TestCase):
    def setUp(self):
        self.user2 = self.create_user()
        self.create_member(user=self.user2, organization=self.organization)
        self.user_actors = {RpcActor.from_orm_user(user) for user in (self.user, self.user2)}

    def test_default_to_slack(self):
        notification = DummyRequestNotification(self.organization, self.user)

        assert notification.get_participants() == {
            ExternalProviders.EMAIL: self.user_actors,
            ExternalProviders.SLACK: self.user_actors,
        }

    def test_turn_off_settings(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.APPROVAL,
            NotificationSettingOptionValues.ALWAYS,
            actor=RpcActor.from_orm_user(self.user),
        )

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.APPROVAL,
            NotificationSettingOptionValues.ALWAYS,
            actor=RpcActor.from_orm_user(self.user2),
        )

        notification = DummyRequestNotification(self.organization, self.user)

        assert notification.get_participants() == {
            ExternalProviders.EMAIL: self.user_actors,
            ExternalProviders.SLACK: self.user_actors,
        }
