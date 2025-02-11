from __future__ import annotations

from typing import TYPE_CHECKING

from django import forms

from sentry.eventstore.models import GroupEvent
from sentry.mail.forms.assigned_to import AssignedToForm
from sentry.models.groupassignee import GroupAssignee
from sentry.models.team import Team
from sentry.notifications.types import ASSIGNEE_CHOICES, AssigneeTargetType
from sentry.rules import EventState
from sentry.rules.filters.base import EventFilter
from sentry.users.services.user.service import user_service
from sentry.utils.cache import cache

if TYPE_CHECKING:
    from sentry.models.group import Group


class AssignedToFilter(EventFilter):
    id = "sentry.rules.filters.assigned_to.AssignedToFilter"
    label = "The issue is assigned to {targetType}"
    prompt = "The issue is assigned to {no one/team/member}"

    form_fields = {"targetType": {"type": "assignee", "choices": ASSIGNEE_CHOICES}}

    def get_assignees(self, group: Group) -> list[GroupAssignee]:
        cache_key = f"group:{group.id}:assignees"
        assignee_list = cache.get(cache_key)
        if assignee_list is None:
            assignee_list = list(group.assignee_set.all())
            cache.set(cache_key, assignee_list, 60)
        return assignee_list

    def passes(self, event: GroupEvent, state: EventState) -> bool:
        target_type = AssigneeTargetType(self.get_option("targetType"))

        if target_type == AssigneeTargetType.UNASSIGNED:
            return len(self.get_assignees(event.group)) == 0
        else:
            target_id = self.get_option("targetIdentifier", None)

            if target_type == AssigneeTargetType.TEAM:
                for assignee in self.get_assignees(event.group):
                    if assignee.team and assignee.team_id == target_id:
                        return True
            elif target_type == AssigneeTargetType.MEMBER:
                for assignee in self.get_assignees(event.group):
                    if assignee.user_id and assignee.user_id == target_id:
                        return True
            return False

    def get_form_instance(self) -> forms.Form:
        return AssignedToForm(self.project, self.data)

    def render_label(self) -> str:
        target_type = AssigneeTargetType(self.get_option("targetType"))
        target_identifer = self.get_option("targetIdentifier")
        if target_type == AssigneeTargetType.TEAM:
            try:
                team = Team.objects.get(id=target_identifer)
            except Team.DoesNotExist:
                return self.label.format(**self.data)
            return self.label.format(targetType=f"team #{team.slug}")

        elif target_type == AssigneeTargetType.MEMBER:
            user = user_service.get_user(user_id=target_identifer)
            if user is not None:
                return self.label.format(targetType=user.username)
            else:
                return self.label.format(**self.data)

        return self.label.format(**self.data)
