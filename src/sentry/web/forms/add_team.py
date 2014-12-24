from __future__ import absolute_import

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.models import AuditLogEntry, AuditLogEntryEvent, Team


class AddTeamForm(forms.ModelForm):
    name = forms.CharField(label=_('Name'), max_length=200,
        widget=forms.TextInput(attrs={
            'placeholder': _('E.g. Platform, API, Website, ...'),
            'required': '',
        }),
    )

    class Meta:
        fields = ('name',)
        model = Team

    def save(self, actor, organization, ip_address):
        team = super(AddTeamForm, self).save(commit=False)
        team.organization = organization
        team.owner = organization.owner
        team.save()

        AuditLogEntry.objects.create(
            organization=organization,
            actor=actor,
            ip_address=ip_address,
            target_object=team.id,
            event=AuditLogEntryEvent.TEAM_ADD,
            data=team.get_audit_log_data(),
        )

        return team
