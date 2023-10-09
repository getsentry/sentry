from __future__ import annotations

import enum
from typing import Generic, TypeVar

from django import forms

from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.services.hybrid_cloud.user.service import user_service

T = TypeVar("T", bound=enum.Enum)


class MemberTeamForm(forms.Form, Generic[T]):
    targetType = forms.ChoiceField()
    targetIdentifier = forms.CharField(
        required=False, help_text="Only required if 'Member' or 'Team' is selected"
    )
    teamValue: T
    memberValue: T
    targetTypeEnum: type[T]

    def __init__(self, project, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.project = project

    def clean_targetIdentifier(self):
        targetIdentifier = self.cleaned_data.get("targetIdentifier")
        # XXX: Clean up some bad data in the database
        if targetIdentifier == "None":
            targetIdentifier = None
        if targetIdentifier:
            try:
                targetIdentifier = int(targetIdentifier)
            except ValueError:
                raise forms.ValidationError("targetIdentifier must be an integer")
        return targetIdentifier

    def clean(self) -> None:
        super().clean()
        cleaned_data = self.cleaned_data
        try:
            targetType = self.targetTypeEnum(cleaned_data.get("targetType"))
        except ValueError:
            msg = forms.ValidationError("Invalid targetType specified")
            self.add_error("targetType", msg)
            return

        targetIdentifier = cleaned_data.get("targetIdentifier")

        self.cleaned_data["targetType"] = targetType.value
        if targetType != self.teamValue and targetType != self.memberValue:
            return

        if not targetIdentifier:
            msg = forms.ValidationError("You need to specify a Team or Member.")
            self.add_error("targetIdentifier", msg)
            return

        if (
            targetType == self.teamValue
            and not Project.objects.filter(
                teams__id=int(targetIdentifier), id=self.project.id
            ).exists()
        ):
            msg = forms.ValidationError("This team is not part of the project.")
            self.add_error("targetIdentifier", msg)
            return

        if targetType == self.memberValue:
            is_active_team_member = OrganizationMemberTeam.objects.filter(
                is_active=True,
                organizationmember__user_id=int(targetIdentifier),
                organizationmember__teams__projectteam__project_id=self.project.id,
            ).exists()
            if is_active_team_member:
                is_active_team_member = bool(
                    user_service.get_many(
                        filter=dict(user_ids=[int(targetIdentifier)], is_active=True)
                    )
                )

            if not is_active_team_member:
                msg = forms.ValidationError("This user is not part of the project.")
                self.add_error("targetIdentifier", msg)
                return

        self.cleaned_data["targetIdentifier"] = targetIdentifier
