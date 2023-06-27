from __future__ import annotations

from django.db.models.signals import post_save

from sentry.models import Activity, Group, record_group_history
from sentry.models.groupinbox import add_group_to_inbox


class BaseStateTransition:
    def update_state(self, group: Group, data: dict | None = None):
        if group.state not in self.from_state:
            raise Exception("Invalid state transition")

        updated = Group.objects.filter(
            id=group.id, status__in=[state.status for state in self.from_states]
        ).update(status=self.to_state.status, substatus=self.to_state.substatus)
        if not updated:
            return

        group_inbox_data = data.get("group_inbox_data", None)
        event = data.get("event", None)
        event_data = {"event_id": event.event_id} if event else None

        group.status = self.to_state.status
        group.substatus = self.to_state.substatus
        post_save.send(
            sender=Group,
            instance=group,
            created=False,
            update_fields=["status", "substatus"],
        )
        add_group_to_inbox(group, self.group_inbox_reason, group_inbox_data)
        record_group_history(group, self.group_history_status)
        Activity.objects.create_group_activity(
            group=group, type=self.activity_type, data=event_data, send_notification=False
        )

    def do(self, group: Group, data: dict | None = None):
        self.update_state(group, data)
