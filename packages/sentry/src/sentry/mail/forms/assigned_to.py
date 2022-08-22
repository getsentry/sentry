from django import forms

from sentry.mail.forms.member_team import MemberTeamForm
from sentry.notifications.types import ASSIGNEE_CHOICES, AssigneeTargetType


class AssignedToForm(MemberTeamForm):
    targetType = forms.ChoiceField(choices=ASSIGNEE_CHOICES)

    teamValue = AssigneeTargetType.TEAM
    memberValue = AssigneeTargetType.MEMBER
    targetTypeEnum = AssigneeTargetType
