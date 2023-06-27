from __future__ import annotations

import logging
from collections import defaultdict
from typing import Sequence

import jsonschema
from django.db.models.signals import post_save

from sentry.issues.forecasts import generate_and_save_forecasts
from sentry.models import Activity, ActivityType, Group, GroupHistoryStatus, record_group_history
from sentry.models.groupinbox import (
    INBOX_REASON_DETAILS,
    GroupInboxReason,
    GroupInboxRemoveAction,
    add_group_to_inbox,
    remove_group_from_inbox,
)
from sentry.models.user import User
from sentry.signals import issue_archived, issue_escalating
from sentry.types.group import UNRESOLVED_STATES, GroupStatus, IssueState
from sentry.utils import metrics

logger = logging.getLogger(__name__)


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


class ToPendingDeletionStateTransition(BaseStateTransition):
    to_state: IssueState = IssueState.PENDING_DELETION

    def bulk_do(self, group_ids: list(int)):
        Group.objects.filter(id__in=group_ids).exclude(
            status__in=[GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS]
        ).update(status=self.to_state.status, substatus=self.to_state.status)


class ToArchiveUntilEscalatingStateTransition(BaseStateTransition):
    from_states: list(IssueState) = UNRESOLVED_STATES
    to_state: IssueState = IssueState.ARCHIVED_UNTIL_ESCALATING
    group_history_status: GroupHistoryStatus = GroupHistoryStatus.ARCHIVED_UNTIL_ESCALATING
    activity_type: ActivityType = ActivityType.SET_IGNORED
    group_inbox_remove_action: GroupInboxRemoveAction = GroupInboxRemoveAction.IGNORED

    def bulk_do(self, group_list: Sequence[Group], data: dict | None = None):
        acting_user: User | None = data.get("acting_user", None)
        projects: User | None = data.get("projects", None)
        sender = data.get("sender", None)

        metrics.incr("group.archived_until_escalating", skip_internal=True)
        for group in group_list:
            remove_group_from_inbox(group, action=self.group_inbox_remove_action, user=acting_user)

        generate_and_save_forecasts(group_list)
        logger.info(
            "archived_until_escalating.forecast_created",
            extra={
                "detail": "Created forecast for groups",
                "group_ids": [group.id for group in group_list],
            },
        )

        groups_by_project_id = defaultdict(list)
        for group in group_list:
            groups_by_project_id[group.project_id].append(group)

        for project in projects:
            project_groups = groups_by_project_id.get(project.id)
            issue_archived.send_robust(
                project=project,
                user=acting_user,
                group_list=project_groups,
                activity_data={"until_escalating": True},
                sender=sender,
            )
