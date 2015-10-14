from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext_lazy as _
from uuid import uuid1

from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, Project, Team
)
from sentry.web.forms.fields import (
    CustomTypedChoiceField, RangeField, OriginsField, IPNetworksField,
)
from sentry.web.frontend.base import ProjectView


BLANK_CHOICE = [("", "")]


class EditProjectForm(forms.ModelForm):
    name = forms.CharField(label=_('Project Name'), max_length=200,
        widget=forms.TextInput(attrs={'placeholder': _('Production')}))
    team = CustomTypedChoiceField(choices=(), coerce=int, required=False)
    origins = OriginsField(label=_('Allowed Domains'), required=False,
        help_text=_('Separate multiple entries with a newline.'))
    token = forms.CharField(label=_('Security token'), required=True,
        help_text=_('Outbound requests matching Allowed Domains will have the header "X-Sentry-Token: {token}" appended.'))
    resolve_age = RangeField(label=_('Auto resolve'), required=False,
        min_value=0, max_value=168, step_value=1,
        help_text=_('Treat an event as resolved if it hasn\'t been seen for this amount of time.'))
    scrub_data = forms.BooleanField(
        label=_('Data Scrubber'),
        help_text=_('Apply server-side data scrubbing to prevent things like passwords and credit cards from being stored.'),
        required=False
    )
    sensitive_fields = forms.CharField(
        label=_('Additional sensitive fields'),
        help_text=_('Additional field names to match against when scrubbing data. Separate multiple entries with a newline.'),
        widget=forms.Textarea(attrs={
            'placeholder': mark_safe(_('e.g. email')),
            'class': 'span8',
            'rows': '3',
        }),
        required=False,
    )
    scrub_ip_address = forms.BooleanField(
        label=_('Don\'t store IP Addresses'),
        help_text=_('Prevent IP addresses from being stored for new events.'),
        required=False
    )
    scrape_javascript = forms.BooleanField(
        label=_('Enable JavaScript source fetching'),
        help_text=_('Allow Sentry to scrape missing JavaScript source context when possible.'),
        required=False,
    )
    blacklisted_ips = IPNetworksField(label=_('Blacklisted IP Addresses'), required=False,
        help_text=_('Separate multiple entries with a newline.'))

    class Meta:
        fields = ('name', 'team', 'slug')
        model = Project

    def __init__(self, request, organization, team_list, data, instance, *args, **kwargs):
        super(EditProjectForm, self).__init__(data=data, instance=instance, *args, **kwargs)

        self.organization = organization
        self.team_list = team_list

        self.fields['team'].choices = self.get_team_choices(team_list, instance.team)
        self.fields['team'].widget.choices = self.fields['team'].choices

    def get_team_label(self, team):
        return '%s (%s)' % (team.name, team.slug)

    def get_team_choices(self, team_list, default=None):
        sorted_team_list = sorted(team_list, key=lambda x: x.name)

        choices = []
        for team in sorted_team_list:
            # TODO: optimize queries
            choices.append(
                (team.id, self.get_team_label(team))
            )

        if default is None:
            choices.insert(0, (-1, mark_safe('&ndash;' * 8)))
        elif default not in sorted_team_list:
            choices.insert(0, (default.id, self.get_team_label(default)))

        return choices

    def clean_sensitive_fields(self):
        value = self.cleaned_data.get('sensitive_fields')
        if not value:
            return

        return filter(bool, (v.lower().strip() for v in value.split('\n')))

    def clean_team(self):
        value = self.cleaned_data.get('team')
        if not value:
            return

        # TODO: why is this not already an int?
        value = int(value)
        if value == -1:
            return

        if self.instance.team and value == self.instance.team.id:
            return self.instance.team

        for team in self.team_list:
            if value == team.id:
                return team

        raise forms.ValidationError('Unable to find chosen team')

    def clean_slug(self):
        slug = self.cleaned_data.get('slug')
        if not slug:
            return
        exists_qs = Project.objects.filter(
            slug=slug,
            organization=self.organization
        ).exclude(id=self.instance.id)
        if exists_qs.exists():
            raise forms.ValidationError('Another project is already using that slug')
        return slug


class ProjectSettingsView(ProjectView):
    required_scope = 'project:write'

    def get_form(self, request, project):
        organization = project.organization
        team_list = [
            t for t in Team.objects.get_for_user(
                organization=organization,
                user=request.user,
            )
            if request.access.has_team_scope(t, self.required_scope)
        ]

        # TODO(dcramer): this update should happen within a lock
        security_token = project.get_option('sentry:token', None)
        if security_token is None:
            security_token = uuid1().hex
            project.update_option('sentry:token', security_token)

        return EditProjectForm(
            request, organization, team_list, request.POST or None,
            instance=project, initial={
                'origins': '\n'.join(project.get_option('sentry:origins', ['*'])),
                'token': security_token,
                'resolve_age': int(project.get_option('sentry:resolve_age', 0)),
                'scrub_data': bool(project.get_option('sentry:scrub_data', True)),
                'sensitive_fields': '\n'.join(project.get_option('sentry:sensitive_fields', None) or []),
                'scrub_ip_address': bool(project.get_option('sentry:scrub_ip_address', False)),
                'scrape_javascript': bool(project.get_option('sentry:scrape_javascript', True)),
                'blacklisted_ips': '\n'.join(project.get_option('sentry:blacklisted_ips', [])),
            },
        )

    def handle(self, request, organization, team, project):
        form = self.get_form(request, project)

        if form.is_valid():
            project = form.save()
            for opt in ('origins', 'resolve_age', 'scrub_data', 'sensitive_fields',
                        'scrape_javascript', 'scrub_ip_address', 'token', 'blacklisted_ips'):
                value = form.cleaned_data.get(opt)
                if value is None:
                    project.delete_option('sentry:%s' % (opt,))
                else:
                    project.update_option('sentry:%s' % (opt,), value)

            AuditLogEntry.objects.create(
                organization=organization,
                actor=request.user,
                ip_address=request.META['REMOTE_ADDR'],
                target_object=project.id,
                event=AuditLogEntryEvent.PROJECT_EDIT,
                data=project.get_audit_log_data(),
            )

            messages.add_message(
                request, messages.SUCCESS,
                _('Changes to your project were saved.'))

            redirect = reverse('sentry-manage-project', args=[project.organization.slug, project.slug])

            return HttpResponseRedirect(redirect)

        context = {
            'form': form,
            'page': 'details',
        }

        return self.respond('sentry/projects/manage.html', context)
