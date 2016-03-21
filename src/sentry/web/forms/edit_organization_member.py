from __future__ import absolute_import

from django import forms

from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, OrganizationMember,
    OrganizationMemberTeam, Team
)


class EditOrganizationMemberForm(forms.ModelForm):
    teams = forms.ModelMultipleChoiceField(
        queryset=Team.objects.none(),
        widget=forms.CheckboxSelectMultiple(),
        required=False,
    )

    class Meta:
        fields = ('role',)
        model = OrganizationMember

    def __init__(self, *args, **kwargs):
        super(EditOrganizationMemberForm, self).__init__(*args, **kwargs)

        self.fields['teams'].queryset = Team.objects.filter(
            organization=self.instance.organization,
        )

    def save(self, actor, organization, ip_address=None):
        om = super(EditOrganizationMemberForm, self).save()

        for team in self.cleaned_data['teams']:
            OrganizationMemberTeam.objects.create_or_update(
                team=team,
                organizationmember=om,
            )

        OrganizationMemberTeam.objects.filter(
            organizationmember=om,
        ).exclude(team__in=self.cleaned_data['teams']).delete()

        AuditLogEntry.objects.create(
            organization=organization,
            actor=actor,
            ip_address=ip_address,
            target_object=om.id,
            target_user=om.user,
            event=AuditLogEntryEvent.MEMBER_EDIT,
            data=om.get_audit_log_data(),
        )

        return om
