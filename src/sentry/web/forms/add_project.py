from __future__ import absolute_import

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.models import AuditLogEntry, AuditLogEntryEvent, Project
from sentry.signals import project_created
from sentry.utils.samples import create_sample_event
from sentry.utils.strings import iter_callsign_choices, validate_callsign


BLANK_CHOICE = [("", "")]


class AddProjectForm(forms.ModelForm):
    name = forms.CharField(label=_('Name'), max_length=200,
        widget=forms.TextInput(attrs={
            'placeholder': _('i.e. API, Frontend, My Application Name'),
        }),
        help_text=_('Using the repository name generally works well.'),
    )
    callsign = forms.CharField(label=_('Callsign'),
        widget=forms.TextInput(attrs={
            'placeholder': _('2-6 letter prefix.  Leave empty '
                             'for auto assignment.'),
        }),
        help_text=_('This is added as prefix for issue IDs.'),
        required=False
    )

    class Meta:
        fields = ('name', 'callsign')
        model = Project

    def __init__(self, organization, *args, **kwargs):
        forms.ModelForm.__init__(self, *args, **kwargs)
        self.organization = organization

    def clean_callsign(self):
        callsign = self.cleaned_data.get('callsign')
        if not callsign:
            it = iter_callsign_choices(self.cleaned_data.get('name') or '')
            for potential_callsign in it:
                try:
                    Project.objects.get(
                        organization=self.organization,
                        callsign=potential_callsign
                    )
                except Project.DoesNotExist:
                    return potential_callsign

        callsign = validate_callsign(callsign)
        if callsign is None:
            raise forms.ValidationError(_('Callsign must be between 2 '
                                          'and 6 letters'))
        try:
            other = Project.objects.get(
                organization=self.organization,
                callsign=callsign
            )
        except Project.DoesNotExist:
            return callsign
        raise forms.ValidationError(_('Another project (%s) is already '
                                      'using that callsign') % other.name)

    def save(self, actor, team, ip_address):
        project = super(AddProjectForm, self).save(commit=False)
        project.team = team
        project.organization = team.organization
        project.save()

        AuditLogEntry.objects.create(
            organization=project.organization,
            actor=actor,
            ip_address=ip_address,
            target_object=project.id,
            event=AuditLogEntryEvent.PROJECT_ADD,
            data=project.get_audit_log_data(),
        )

        project_created.send(project=project, user=actor, sender=self)

        create_sample_event(project, platform='javascript')

        return project
