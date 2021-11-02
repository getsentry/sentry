from sentry.models import NotificationSetting, OrganizationMember
from sentry.notifications.notifications.organization_request import OrganizationRequestNotification
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.testutils import TestCase
from sentry.testutils.helpers import with_feature
from sentry.types.integrations import ExternalProviders


class DummyRequestNotification(OrganizationRequestNotification):
    def __init__(self, organization, requester, member_ids):
        super().__init__(organization, requester)
        self.member_ids = member_ids

    def determine_member_recipients(self):
        return OrganizationMember.objects.filter(id__in=self.member_ids)


class GetParticipantsTest(TestCase):
    def setUp(self):
        self.user1 = self.create_user()
        self.user2 = self.create_user()
        self.member1 = self.create_member(user=self.user1, organization=self.organization)
        self.member2 = self.create_member(user=self.user2, organization=self.organization)

    @with_feature("organizations:slack-requests")
    def test_default_to_slack(self):
        member_ids = [self.member1.id, self.member2.id]
        notification = DummyRequestNotification(self.organization, self.user, member_ids)

        assert notification.get_participants() == {
            ExternalProviders.EMAIL: {self.user1, self.user2},
            ExternalProviders.SLACK: {self.user1, self.user2},
        }

    @with_feature("organizations:slack-requests")
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

        member_ids = [self.member1.id, self.member2.id]
        notification = DummyRequestNotification(self.organization, self.user, member_ids)

        assert notification.get_participants() == {
            ExternalProviders.EMAIL: {self.user2},
            ExternalProviders.SLACK: {self.user1},
        }
