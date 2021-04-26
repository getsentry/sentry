from django import forms

from sentry.mail.forms.member_team import MemberTeamForm
from sentry.notifications.types import ACTION_CHOICES, ActionTargetType


class NotifyEmailForm(MemberTeamForm):
    targetType = forms.ChoiceField(choices=ACTION_CHOICES)

    teamValue = ActionTargetType.TEAM
    memberValue = ActionTargetType.MEMBER
    targetTypeEnum = ActionTargetType
