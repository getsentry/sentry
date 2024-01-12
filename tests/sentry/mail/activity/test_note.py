from sentry.models.activity import Activity
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.options.user_option import UserOption
from sentry.notifications.notifications.activity.note import NoteActivityNotification
from sentry.notifications.types import GroupSubscriptionReason
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.silo.base import SiloMode
from sentry.testutils.cases import ActivityTestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.activity import ActivityType
from sentry.types.integrations import ExternalProviders


class NoteTestCase(ActivityTestCase):
    def setUp(self):
        super().setUp()
        self.email = NoteActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user_id=self.user.id,
                type=ActivityType.NOTE,
                data={"text": "text", "mentions": []},
            )
        )

    def test_simple(self):
        # Defaults: SUBSCRIBE_ONLY and self_notifications:0
        assert self.email.get_participants_with_group_subscription_reason().is_empty()

    def test_allow_self_notifications(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type="workflow",
                value="always",
            )
        UserOption.objects.create(user=self.user, key="self_notifications", value="1")

        participants = self.email.get_participants_with_group_subscription_reason()
        actual = dict(participants.get_participants_by_provider(ExternalProviders.EMAIL))
        expected = {
            RpcActor.from_orm_user(self.user): GroupSubscriptionReason.implicit,
        }
        assert actual == expected

    def test_disable_self_notifications(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type="workflow",
                value="always",
            )
        UserOption.objects.create(user=self.user, key="self_notifications", value="0")

        participants = self.email.get_participants_with_group_subscription_reason()
        assert len(participants.get_participants_by_provider(ExternalProviders.EMAIL)) == 0

    def test_note_with_braces(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type="workflow",
                value="always",
            )
        UserOption.objects.create(user=self.user, key="self_notifications", value="1")
        email = NoteActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user_id=self.user.id,
                type=ActivityType.NOTE,
                data={"text": "{abc.property}", "mentions": []},
            )
        )

        context = email.get_context()
        assert context["text_description"] == "{abc.property}"
