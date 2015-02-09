from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.core.validators import URLValidator
from django.http import HttpResponseRedirect
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext_lazy as _
from uuid import uuid1

from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, OrganizationMemberType, Project, Team
)
from sentry.permissions import can_remove_project, can_set_public_projects
from sentry.plugins import plugins
from sentry.web.forms.fields import CustomTypedChoiceField, RangeField
from sentry.web.frontend.base import ProjectView
from sentry.utils.http import parse_uri_match


BLANK_CHOICE = [("", "")]

# Special case origins that don't fit the normal regex pattern, but are valid
WHITELIST_ORIGINS = ('*')


class OriginsField(forms.CharField):
    _url_validator = URLValidator()
    widget = forms.Textarea(
        attrs={
            'placeholder': mark_safe(_('e.g. example.com or https://example.com')),
            'class': 'span8',
        },
    )

    def clean(self, value):
        if not value:
            return []
        values = filter(bool, (v.strip() for v in value.split('\n')))
        for value in values:
            if not self.is_valid_origin(value):
                raise forms.ValidationError('%r is not an acceptable value' % value)
        return values

    def is_valid_origin(self, value):
        if value in WHITELIST_ORIGINS:
            return True

        bits = parse_uri_match(value)
        # ports are not supported on matching expressions (yet)
        if ':' in bits.domain:
            return False

        return True


class EditProjectForm(forms.ModelForm):
    name = forms.CharField(label=_('Project Name'), max_length=200,
        widget=forms.TextInput(attrs={'placeholder': _('Production')}))
    platform = forms.ChoiceField(choices=Project._meta.get_field('platform').get_choices(blank_choice=BLANK_CHOICE),
        widget=forms.Select(attrs={'data-placeholder': _('Select a platform')}))
    public = forms.BooleanField(required=False,
        help_text=_('Imply public access to any event for this project.'))
    team = CustomTypedChoiceField(choices=(), coerce=int, required=False)
    origins = OriginsField(label=_('Allowed Domains'), required=False,
        help_text=_('Separate multiple entries with a newline.'))
    token = forms.CharField(label=_('Security token'), required=True,
        help_text=_('Outbound requests matching Allowed Domains will have the header "X-Sentry-Token: {token}" appended.'))
    resolve_age = RangeField(help_text=_('Treat an event as resolved if it hasn\'t been seen for this amount of time.'),
        required=False, min_value=0, max_value=168, step_value=1)
    scrub_data = forms.BooleanField(
        label=_('Data Scrubber'),
        help_text=_('Apply server-side data scrubbing to prevent things like passwords and credit cards from being stored.'),
        required=False
    )
    scrub_ip_address = forms.BooleanField(
        label=_('Don\'t store IP Addresses'),
        help_text=_('Prevent IP addresses from being stored for new events.'),
        required=False
    )

    class Meta:
        fields = ('name', 'platform', 'public', 'team', 'slug')
        model = Project

    def __init__(self, request, organization, team_list, data, instance, *args, **kwargs):
        super(EditProjectForm, self).__init__(data=data, instance=instance, *args, **kwargs)

        self.organization = organization
        self.team_list = team_list

        if not can_set_public_projects(request.user):
            del self.fields['public']
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
    required_access = OrganizationMemberType.ADMIN

    def get_default_context(self, request, **kwargs):
        context = super(ProjectSettingsView, self).get_default_context(request, **kwargs)
        context.update({
            'can_remove_project': can_remove_project(request.user, kwargs['project']),
        })
        return context

    def has_permission(self, request, organization, team, project):
        if project is None:
            return False

        if request.user.is_superuser:
            return True

        result = plugins.first('has_perm', request.user, 'edit_project', project)
        if result is False:
            return False

        return True

    def get_form(self, request, project):
        organization = project.organization
        if request.user.is_superuser:
            accessing_user = organization.owner
        else:
            accessing_user = request.user

        team_list = Team.objects.get_for_user(
            organization=organization,
            user=accessing_user,
            access=OrganizationMemberType.ADMIN,
        )

        # TODO(dcramer): this update should happen within a lock
        security_token = project.get_option('sentry:token', None)
        if security_token is None:
            security_token = uuid1().hex
            project.update_option('sentry:token', security_token)

        return EditProjectForm(
            request, organization, team_list, request.POST or None,
            instance=project, initial={
                'origins': '\n'.join(project.get_option('sentry:origins', None) or []),
                'token': security_token,
                'resolve_age': int(project.get_option('sentry:resolve_age', 0)),
                'scrub_data': bool(project.get_option('sentry:scrub_data', True)),
                'scrub_ip_address': bool(project.get_option('sentry:scrub_ip_address', False)),
            },
        )

    def handle(self, request, organization, team, project):
        form = self.get_form(request, project)

        if form.is_valid():
            project = form.save()
            for opt in ('origins', 'resolve_age', 'scrub_data', 'scrub_ip_address', 'token'):
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
        }

        return self.respond('sentry/projects/manage.html', context)
