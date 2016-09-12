from __future__ import absolute_import

from django import forms
from django.db import transaction

from sentry.models import (
    OrganizationMember,
    OrganizationMemberTeam,
    Team,
)


class BaseOrganizationMemberForm(forms.ModelForm):
    """
    Base form used by AddOrganizationMemberForm, InviteOrganizationMemberForm,
    and EditOrganizationMemberForm
    """
    teams = forms.ModelMultipleChoiceField(
        queryset=Team.objects.none(),
        widget=forms.CheckboxSelectMultiple(),
        required=False,
    )
    role = forms.ChoiceField()

    class Meta:
        fields = ('role',)
        model = OrganizationMember

    def __init__(self, *args, **kwargs):
        allowed_roles = kwargs.pop('allowed_roles')
        all_teams = kwargs.pop('all_teams')

        super(BaseOrganizationMemberForm, self).__init__(*args, **kwargs)

        self.fields['role'].choices = (
            (r.id, r.name)
            for r in allowed_roles
        )

        self.fields['teams'].queryset = all_teams

    @transaction.atomic
    def save_team_assignments(self, organization_member):
        OrganizationMemberTeam.objects.filter(organizationmember=organization_member).delete()
        OrganizationMemberTeam.objects.bulk_create([
            OrganizationMemberTeam(team=team,
                                   organizationmember=organization_member)
            for team in self.cleaned_data['teams']
        ])
