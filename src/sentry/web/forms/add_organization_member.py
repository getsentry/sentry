from __future__ import absolute_import

from django import forms
from django.db import transaction, IntegrityError

from sentry.models import (
    AuditLogEntry,
    AuditLogEntryEvent,
    OrganizationMember,
    OrganizationMemberTeam,
    Team,
)
from sentry.web.forms.fields import UserField


class AddOrganizationMemberForm(forms.ModelForm):
    user = UserField()

    teams = forms.ModelMultipleChoiceField(
        queryset=Team.objects.none(),
        widget=forms.CheckboxSelectMultiple(),
        required=False,
    )
    role = forms.ChoiceField()

    class Meta:
        fields = ('user',)
        model = OrganizationMember

    def __init__(self, *args, **kwargs):
        allowed_roles = kwargs.pop('allowed_roles')
        all_teams = kwargs.pop('all_teams')

        super(AddOrganizationMemberForm, self).__init__(*args, **kwargs)

        self.fields['role'].choices = (
            (r.id, r.name)
            for r in allowed_roles
        )

        self.fields['teams'].queryset = all_teams

    def save(self, actor, organization, ip_address):
        om = super(AddOrganizationMemberForm, self).save(commit=False)
        om.organization = organization

        with transaction.atomic():
            try:
                om.save()
            except IntegrityError:
                return OrganizationMember.objects.get(
                    user=om.user,
                    organization=organization,
                ), False

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
            event=AuditLogEntryEvent.MEMBER_ADD,
            data=om.get_audit_log_data(),
        )

        return om, True
