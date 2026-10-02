from __future__ import annotations

from django import forms

from sentry.mail.forms.assigned_to import AssignedToForm
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.notifications.types import ASSIGNEE_CHOICES, AssigneeTargetType
from sentry.rules.filters.base import EventFilter
from sentry.users.services.user.service import user_service


class AssignedToFilter(EventFilter):
    id = "sentry.rules.filters.assigned_to.AssignedToFilter"
    label = "The issue is assigned to {targetType}"
    prompt = "The issue is assigned to {no one/team/member}"

    form_fields = {"targetType": {"type": "assignee", "choices": ASSIGNEE_CHOICES}}

    def get_form_instance(self) -> forms.Form:
        return AssignedToForm(self.project, self.data)

    def render_label(self) -> str:
        target_type = AssigneeTargetType(self.get_option("targetType"))
        target_identifer = self.get_option("targetIdentifier")
        organization_id = self.project.organization_id
        if target_type == AssigneeTargetType.TEAM:
            try:
                team = Team.objects.get(id=target_identifer, organization_id=organization_id)
            except Team.DoesNotExist:
                return self.label.format(**self.data)
            return self.label.format(targetType=f"team #{team.slug}")

        elif target_type == AssigneeTargetType.MEMBER:
            if not OrganizationMember.objects.filter(
                user_id=target_identifer, organization_id=organization_id
            ).exists():
                return self.label.format(**self.data)
            user = user_service.get_user(user_id=target_identifer)
            if user is not None:
                return self.label.format(targetType=user.username)
            else:
                return self.label.format(**self.data)

        return self.label.format(**self.data)
