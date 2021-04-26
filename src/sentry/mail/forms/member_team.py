from django import forms

from sentry.models import Project, User


class MemberTeamForm(forms.Form):
    targetType = forms.ChoiceField()
    targetIdentifier = forms.CharField(
        required=False, help_text="Only required if 'Member' or 'Team' is selected"
    )
    teamValue = None
    memberValue = None
    targetTypeEnum = None

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

    def clean(self):
        cleaned_data = super().clean()
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

        if (
            targetType == self.memberValue
            and not User.objects.get_from_projects(self.project.organization.id, [self.project])
            .filter(id=int(targetIdentifier))
            .exists()
        ):
            msg = forms.ValidationError("This user is not part of the project.")
            self.add_error("targetIdentifier", msg)
            return

        self.cleaned_data["targetIdentifier"] = targetIdentifier
