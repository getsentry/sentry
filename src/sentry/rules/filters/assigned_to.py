from __future__ import absolute_import

from django import forms

from sentry.rules.filters.base import EventFilter
from sentry.mail.actions import MemberTeamForm
from sentry.utils.cache import cache


class AssigneeTargetType:
    UNASSIGNED = "Unassigned"
    TEAM = "Team"
    MEMBER = "Member"


CHOICES = [
    (AssigneeTargetType.UNASSIGNED, "Unassigned"),
    (AssigneeTargetType.TEAM, "Team"),
    (AssigneeTargetType.MEMBER, "Member"),
]


class AssignedToForm(MemberTeamForm):
    targetType = forms.ChoiceField(choices=CHOICES)

    teamValue = AssigneeTargetType.TEAM
    memberValue = AssigneeTargetType.MEMBER


class AssignedToFilter(EventFilter):
    form_cls = AssignedToForm
    label = "The issue is assigned to {targetType}"
    prompt = "The issue is assigned to {No One/Team/Member}"

    form_fields = {"targetType": {"type": "assignee", "choices": CHOICES}}

    def get_assignees(self, group):
        cache_key = u"group:{}:assignees".format(group.id)
        assignee_list = cache.get(cache_key)
        if assignee_list is None:
            assignee_list = list(group.assignee_set.all())
            cache.set(cache_key, assignee_list, 60)
        return assignee_list

    def passes(self, event, state):
        targetType = self.get_option("targetType")

        if targetType == AssigneeTargetType.UNASSIGNED:
            return len(self.get_assignees(event.group)) == 0
        else:
            targetId = self.get_option("targetIdentifier", None)

            if targetType == AssigneeTargetType.TEAM:
                for assignee in self.get_assignees(event.group):
                    if assignee.team and assignee.team_id == targetId:
                        return True
            elif targetType == AssigneeTargetType.MEMBER:
                for assignee in self.get_assignees(event.group):
                    if assignee.user and assignee.user_id == targetId:
                        return True
            return False

    def get_form_instance(self):
        return self.form_cls(self.project, self.data)
