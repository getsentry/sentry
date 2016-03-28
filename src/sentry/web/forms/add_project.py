from __future__ import absolute_import

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.models import AuditLogEntry, AuditLogEntryEvent, Project
from sentry.signals import project_created
from sentry.utils.samples import create_sample_event


BLANK_CHOICE = [("", "")]


class AddProjectForm(forms.ModelForm):
    name = forms.CharField(label=_('Name'), max_length=200,
        widget=forms.TextInput(attrs={
            'placeholder': _('i.e. API, Frontend, My Application Name'),
        }),
        help_text=_('Using the repository name generally works well.'),
    )

    class Meta:
        fields = ('name',)
        model = Project

    def __init__(self, organization, *args, **kwargs):
        forms.ModelForm.__init__(self, *args, **kwargs)
        self.organization = organization

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
