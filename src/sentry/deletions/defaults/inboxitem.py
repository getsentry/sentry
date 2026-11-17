from collections.abc import Sequence

from sentry.constants import ObjectStatus
from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.notifications.models.inboxitem import InboxItem
from sentry.notifications.models.inboxitemevent import InboxItemEvent


class InboxItemDeletionTask(ModelDeletionTask[InboxItem]):
    def should_proceed(self, instance: InboxItem) -> bool:
        return instance.status in {
            ObjectStatus.PENDING_DELETION,
            ObjectStatus.DELETION_IN_PROGRESS,
        }

    def get_child_relations_bulk(self, instance_list: Sequence[InboxItem]) -> list[BaseRelation]:
        return [
            ModelRelation(
                InboxItemEvent, {"inbox_item_id__in": [item.id for item in instance_list]}
            )
        ]
