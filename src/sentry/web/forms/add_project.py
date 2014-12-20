from __future__ import absolute_import

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.models import AuditLogEntry, AuditLogEntryEvent, Project
from sentry.utils.samples import create_sample_event


BLANK_CHOICE = [("", "")]


class AddProjectForm(forms.ModelForm):
    name = forms.CharField(label=_('Name'), max_length=200,
        widget=forms.TextInput(attrs={
            'placeholder': _('e.g. Backend, Frontend, iOS, Android'),
        }),
    )
    platform = forms.ChoiceField(
        choices=Project._meta.get_field('platform').get_choices(blank_choice=BLANK_CHOICE),
        widget=forms.Select(attrs={
            'data-placeholder': _('Select a platform'),
        }),
        help_text='Your platform choice helps us setup some defaults for this project.',
    )

    class Meta:
        fields = ('name', 'platform')
        model = Project

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

        create_sample_event(project)

        return project
