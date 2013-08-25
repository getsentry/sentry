"""
sentry.web.forms.projects
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import itertools
from django import forms
from django.conf import settings
from django.contrib.auth import authenticate
from django.utils.translation import ugettext_lazy as _
from sentry.constants import EMPTY_PASSWORD_VALUES
from sentry.models import Project, ProjectOption, User
from sentry.permissions import can_set_public_projects
from sentry.web.forms.fields import (
    RadioFieldRenderer, UserField, OriginsField, RangeField, get_team_choices)


BLANK_CHOICE = [("", "")]


class ProjectTagsForm(forms.Form):
    filters = forms.MultipleChoiceField(choices=(), widget=forms.CheckboxSelectMultiple(), required=False)

    def __init__(self, project, tag_list, *args, **kwargs):
        self.project = project
        super(ProjectTagsForm, self).__init__(*args, **kwargs)

        self.fields['filters'].choices = tuple(
            (k, '%s (%s)' % (k.replace('_', ' ').title(), k))
            for k in itertools.imap(unicode, tag_list)
        )
        self.fields['filters'].widget.choices = self.fields['filters'].choices

        enabled_tags = ProjectOption.objects.get_value(self.project, 'tags', tag_list)
        self.fields['filters'].initial = enabled_tags

    def save(self):
        filters = self.cleaned_data.get('filters')
        ProjectOption.objects.set_value(self.project, 'tags', filters)


class BaseProjectForm(forms.ModelForm):
    name = forms.CharField(label=_('Project Name'), max_length=200,
        widget=forms.TextInput(attrs={'placeholder': _('Production')}))
    platform = forms.ChoiceField(choices=Project._meta.get_field('platform').get_choices(blank_choice=BLANK_CHOICE),
        widget=forms.Select(attrs={'data-placeholder': _('Select a platform')}))

    class Meta:
        fields = ('name', 'platform')
        model = Project


class NewProjectForm(BaseProjectForm):
    pass


class NewProjectAdminForm(NewProjectForm):
    owner = UserField(required=False)

    class Meta:
        fields = ('name', 'platform')
        model = Project


class RemoveProjectForm(forms.Form):
    removal_type = forms.ChoiceField(choices=(
        ('1', _('Remove all attached events.')),
        ('2', _('Migrate events to another project.')),
        # ('3', _('Hide this project.')),
    ), widget=forms.RadioSelect(renderer=RadioFieldRenderer))
    project = forms.ChoiceField(choices=(), required=False)
    password = forms.CharField(label=_("Password"), widget=forms.PasswordInput, help_text=_("Confirm your identity by entering your password."))

    def __init__(self, user, project_list, *args, **kwargs):
        super(RemoveProjectForm, self).__init__(*args, **kwargs)
        self.user = user
        if not project_list:
            del self.fields['project']
            self.fields['removal_type'].choices = filter(lambda x: x[0] != '2', self.fields['removal_type'].choices)
        else:
            self.fields['project'].choices = [(p.pk, p.name) for p in project_list]
            self.fields['project'].widget.choices = self.fields['project'].choices

        # HACK: don't require current password if they don't have one
        if self.user.password in EMPTY_PASSWORD_VALUES:
            del self.fields['password']

    def clean(self):
        data = self.cleaned_data
        if data.get('removal_type') == 2 and not data.get('project'):
            raise forms.ValidationError(_('You must select a project to migrate data'))
        return data

    def clean_project(self):
        project_id = self.cleaned_data['project']
        return Project.objects.get_from_cache(id=project_id)

    def clean_password(self):
        """
        Validates that the old_password field is correct.
        """
        password = self.cleaned_data["password"]
        if not isinstance(authenticate(username=self.user.username, password=password), User):
            raise forms.ValidationError(_("Your password was entered incorrectly. Please enter it again."))
        return password


class EditProjectForm(BaseProjectForm):
    public = forms.BooleanField(required=False,
        help_text=_('Imply public access to any event for this project.'))
    team = forms.TypedChoiceField(choices=(), coerce=int, required=False)
    origins = OriginsField(label=_('Allowed Domains'), required=False,
        help_text=_('Separate multiple entries with a newline.'))
    resolve_age = RangeField(help_text=_('Treat an event as resolved if it hasn\'t been seen for this amount of time.'),
        required=False, min_value=0, max_value=168, step_value=1)
    owner = UserField(required=False)

    class Meta:
        fields = ('name', 'platform', 'public', 'team', 'owner', 'slug')
        model = Project

    def __init__(self, request, team_list, data, instance, *args, **kwargs):
        super(EditProjectForm, self).__init__(data=data, instance=instance, *args, **kwargs)
        self.team_list = dict((t.pk, t) for t in team_list.itervalues())

        if not can_set_public_projects(request.user):
            del self.fields['public']
        if len(team_list) == 1 and instance.team == team_list.values()[0]:
            del self.fields['team']
        else:
            self.fields['team'].choices = get_team_choices(self.team_list, instance.team)
            self.fields['team'].widget.choices = self.fields['team'].choices

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

        return self.team_list[value]


class AlertSettingsForm(forms.Form):
    pct_threshold = RangeField(
        label=_('Threshold'), required=False, min_value=0, max_value=1000, step_value=100,
        help_text=_('Notify when the rate of events increases by this percentage.'))
    min_events = forms.IntegerField(
        label=_('Minimum Events'), required=False, min_value=0,
        help_text=_('Generate an alert only when an event is seen more than this many times during the interval.'),)


class NotificationTagValuesForm(forms.Form):
    values = forms.CharField(required=False)

    def __init__(self, project, tag, *args, **kwargs):
        self.project = project
        self.tag = tag
        super(NotificationTagValuesForm, self).__init__(*args, **kwargs)
        self.fields['values'].label = self.tag
        self.fields['values'].widget.attrs['data-tag'] = self.tag

    def clean_values(self):
        return set(filter(bool, self.cleaned_data.get('values').split(',')))


class ProjectQuotasForm(forms.Form):
    per_minute = forms.CharField(
        label=_('Maximum events per minute'),
        widget=forms.TextInput(attrs={'placeholder': 'e.g. 90% or 100'}),
        help_text=_('This cannot be higher than the team (or system) allotted maximum. The value can be either a fixed number, or a percentage that is relative to the team\'s overall quota.'),
        required=False
    )

    def __init__(self, project, *args, **kwargs):
        self.project = project
        super(ProjectQuotasForm, self).__init__(*args, **kwargs)
        per_minute = ProjectOption.objects.get_value(
            self.project, 'quotas:per_minute', None
        )
        if per_minute is None:
            per_minute = settings.SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE
        self.fields['per_minute'].initial = per_minute

    def clean_per_minute(self):
        value = self.cleaned_data.get('per_minute')
        if not value:
            return value
        if value.endswith('%'):
            try:
                pct = int(value[:-1])
            except (TypeError, ValueError):
                raise forms.ValidationError('Invalid percentage')
            if pct > 100:
                raise forms.ValidationError('Invalid percentage')
            if pct == 0:
                value = '0'
        return value

    def save(self):
        ProjectOption.objects.set_value(
            self.project, 'quotas:per_minute', self.cleaned_data['per_minute'] or ''
        )
