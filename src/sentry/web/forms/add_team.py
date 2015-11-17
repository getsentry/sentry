from __future__ import absolute_import

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, OrganizationMember,
    OrganizationMemberTeam, Team
)


class AddTeamForm(forms.ModelForm):
    name = forms.CharField(label=_('Name'), max_length=200,
        widget=forms.TextInput(attrs={
            'placeholder': _('E.g. Operations, Web, Desktop, ...'),
            'required': '',
        }),
        help_text='The team name has no significant impact and can be changed later.',
    )

    class Meta:
        fields = ('name',)
        model = Team

    def save(self, actor, organization, ip_address):
        team = super(AddTeamForm, self).save(commit=False)
        team.organization = organization
        team.save()

        try:
            member = OrganizationMember.objects.get(
                user=actor,
                organization=organization,
            )
        except OrganizationMember.DoesNotExist:
            pass
        else:
            OrganizationMemberTeam.objects.create(
                team=team,
                organizationmember=member,
                is_active=True,
            )

        AuditLogEntry.objects.create(
            organization=organization,
            actor=actor,
            ip_address=ip_address,
            target_object=team.id,
            event=AuditLogEntryEvent.TEAM_ADD,
            data=team.get_audit_log_data(),
        )

        return team
