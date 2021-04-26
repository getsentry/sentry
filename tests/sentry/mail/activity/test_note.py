from sentry.models import Activity, NotificationSetting, UserOption
from sentry.notifications.activity import NoteActivityNotification
from sentry.notifications.types import (
    GroupSubscriptionReason,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.types.activity import ActivityType
from sentry.types.integrations import ExternalProviders
from tests.sentry.mail.activity import ActivityTestCase


class NoteTestCase(ActivityTestCase):
    def setUp(self):
        super().setUp()
        self.email = NoteActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.NOTE,
                data={"text": "text", "mentions": []},
            )
        )

    def test_simple(self):
        # Defaults: SUBSCRIBE_ONLY and self_notifications:0
        assert not self.email.get_participants_with_group_subscription_reason()

    def test_allow_self_notifications(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )
        UserOption.objects.create(user=self.user, key="self_notifications", value="1")

        participants = self.email.get_participants_with_group_subscription_reason()[
            ExternalProviders.EMAIL
        ]
        assert len(participants) == 1
        assert participants == {
            self.user: GroupSubscriptionReason.implicit,
        }

    def test_disable_self_notifications(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )
        UserOption.objects.create(user=self.user, key="self_notifications", value="0")

        participants = self.email.get_participants_with_group_subscription_reason()[
            ExternalProviders.EMAIL
        ]
        assert len(participants) == 0
