from __future__ import annotations

import logging

import jsonschema
from django.db.models.signals import post_save

from sentry.models import Activity, ActivityType, Group, GroupHistoryStatus, record_group_history
from sentry.models.groupinbox import INBOX_REASON_DETAILS, GroupInboxReason, add_group_to_inbox
from sentry.signals import issue_escalating
from sentry.types.group import IssueState


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


class ToEscalatingStateTransition(BaseStateTransition):
    from_states: list(IssueState) = [
        IssueState.ARCHIVED_UNTIL_ESCALATING,
        IssueState.ARCHIVED_UNTIL_CONDITION_MET,
    ]
    to_state: IssueState = IssueState.ESCALATING
    group_history_status: GroupHistoryStatus = GroupHistoryStatus.ESCALATING
    activity_type: ActivityType = ActivityType.SET_ESCALATING
    group_inbox_reason: GroupInboxReason = GroupInboxReason.ESCALATING

    # TODO(snigdha): this can reuse most of the super().do() logic
    def do(self, group: Group, data: dict | None = None):
        if group.state not in self.from_state:
            raise Exception("Invalid state transition")

        event = data.get("event", None)
        snooze_details = data.get("snooze_details", None)
        activity_data = data.get("activity_data", None)
        event_data = {"event_id": event.event_id} if event else None
        updated = Group.objects.filter(id=group.id, status=self.from_state.status).update(
            status=self.to_state.status, substatus=self.to_state.substatus
        )
        if not updated:
            return
        group.status = self.to_state.status
        group.substatus = self.to_state.substatus
        post_save.send(
            sender=Group,
            instance=group,
            created=False,
            update_fields=["status", "substatus"],
        )
        add_group_to_inbox(group, self.group_inbox_reason, snooze_details)
        record_group_history(group, self.group_history_status)

        has_forecast = (
            True if event_data and activity_data and "forecast" in activity_data.keys() else False
        )
        issue_escalating.send_robust(
            project=group.project,
            group=group,
            event=event,
            sender=ToEscalatingStateTransition.do,
            was_until_escalating=True if has_forecast else False,
        )
        if event_data and activity_data and has_forecast:  # Redundant checks needed for typing
            event_data.update(activity_data)
        if data and snooze_details:
            try:
                jsonschema.validate(snooze_details, INBOX_REASON_DETAILS)

            except jsonschema.ValidationError:
                logging.error("Expired snooze_details invalid jsonschema", extra=snooze_details)

            data.update({"expired_snooze": snooze_details})

        Activity.objects.create_group_activity(
            group=group, type=self.activity_type, data=event_data
        )


class ToOngoingStateTransition(BaseStateTransition):
    from_states: list(IssueState) = [
        IssueState.RESOLVED,
        IssueState.ARCHIVED_FOREVER,
        # TODO(snigdha): this should be removed once escalating-issues is GA
        IssueState.ARCHIVED_UNTIL_CONDITION_MET,
    ]
    to_state: IssueState = IssueState.ONGOING
    group_history_status: GroupHistoryStatus = GroupHistoryStatus.ONGOING
    activity_type: ActivityType = ActivityType.SET_UNRESOLVED
    group_inbox_reason: GroupInboxReason = GroupInboxReason.ONGOING


class ToUnignoredStateTransition(BaseStateTransition):
    from_states: list(IssueState) = [
        IssueState.RESOLVED,
        IssueState.ARCHIVED_FOREVER,
        # TODO(snigdha): this should be removed once escalating-issues is GA
        IssueState.ARCHIVED_UNTIL_CONDITION_MET,
    ]
    to_state: IssueState = IssueState.ONGOING
    group_history_status: GroupHistoryStatus = GroupHistoryStatus.UNIGNORED
    activity_type: ActivityType = ActivityType.SET_UNRESOLVED
    group_inbox_reason: GroupInboxReason = GroupInboxReason.UNIGNORED
