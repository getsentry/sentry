from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.notifications.tasks import RETENTION_DAYS, delete_old_notification_messages
from sentry.testutils.cases import TestCase


class DeleteOldNotificationMessagesTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.action = self.create_action()
        self.group = self.create_group()

    def _create_message(self, days_old: int, **kwargs) -> NotificationMessage:
        kwargs.setdefault("action", self.action)
        kwargs.setdefault("group", self.group)
        message = NotificationMessage.objects.create(**kwargs)
        NotificationMessage.objects.filter(id=message.id).update(
            date_added=timezone.now() - timedelta(days=days_old)
        )
        message.refresh_from_db()
        return message

    def test_deletes_messages_older_than_retention(self) -> None:
        old = self._create_message(days_old=RETENTION_DAYS + 1)
        very_old = self._create_message(days_old=RETENTION_DAYS + 365)
        recent = self._create_message(days_old=RETENTION_DAYS - 1)
        brand_new = self._create_message(days_old=0)

        delete_old_notification_messages()

        remaining_ids = set(NotificationMessage.objects.values_list("id", flat=True))
        assert remaining_ids == {recent.id, brand_new.id}
        assert old.id not in remaining_ids
        assert very_old.id not in remaining_ids

    def test_no_op_when_nothing_to_delete(self) -> None:
        recent = self._create_message(days_old=1)

        delete_old_notification_messages()

        assert NotificationMessage.objects.filter(id=recent.id).exists()

    def test_cascades_self_reference(self) -> None:
        parent = self._create_message(days_old=RETENTION_DAYS + 5)
        child = self._create_message(
            days_old=RETENTION_DAYS + 5, parent_notification_message=parent
        )

        delete_old_notification_messages()

        assert not NotificationMessage.objects.filter(id__in=[parent.id, child.id]).exists()

    def test_respects_per_run_cap(self) -> None:
        cutoff_time = timezone.now() - timedelta(days=RETENTION_DAYS + 1)
        NotificationMessage.objects.bulk_create(
            [NotificationMessage(action=self.action, group=self.group) for _ in range(5)]
        )
        NotificationMessage.objects.all().update(date_added=cutoff_time)

        with (
            patch("sentry.notifications.tasks.BATCH_SIZE", 2),
            patch("sentry.notifications.tasks.MAX_BATCHES", 2),
        ):
            delete_old_notification_messages()

        # 2 batches of 2 deleted; the 5th old row waits for the next run.
        assert NotificationMessage.objects.count() == 1
