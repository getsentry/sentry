"""
sentry.web.forms.projects
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django import forms
from django.conf import settings
from django.utils.translation import ugettext_lazy as _

from sentry.constants import TAG_LABELS
from sentry.models import Project, ProjectOption
from sentry.permissions import can_set_public_projects
from sentry.web.forms.fields import (
    UserField, OriginsField, RangeField, get_team_choices)


BLANK_CHOICE = [("", "")]


class ProjectTagsForm(forms.Form):
    filters = forms.MultipleChoiceField(
        choices=(), widget=forms.CheckboxSelectMultiple(), required=False)
    annotations = forms.MultipleChoiceField(
        choices=(), widget=forms.CheckboxSelectMultiple(), required=False)

    def __init__(self, project, tag_list, *args, **kwargs):
        self.project = project
        super(ProjectTagsForm, self).__init__(*args, **kwargs)

        tag_choices = []
        for tag in tag_list:
            tag_choices.append(
                (tag, TAG_LABELS.get(tag) or tag.replace(u'_', u' ').title())
            )

        for field in ('filters', 'annotations'):
            self.fields[field].choices = tag_choices
            self.fields[field].widget.choices = self.fields[field].choices

        enabled_filters = ProjectOption.objects.get_value(
            self.project, 'tags', tag_list)
        self.fields['filters'].initial = enabled_filters

        enable_annotations = ProjectOption.objects.get_value(
            self.project, 'annotations', ['sentry:user'])
        self.fields['annotations'].initial = enable_annotations

    def save(self):
        filters = self.cleaned_data.get('filters')
        ProjectOption.objects.set_value(
            self.project, 'tags', filters)

        annotations = self.cleaned_data.get('annotations')
        ProjectOption.objects.set_value(
            self.project, 'annotations', annotations)


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
    def __init__(self, user, *args, **kwargs):
        super(RemoveProjectForm, self).__init__(*args, **kwargs)
        self.user = user


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


class NotificationSettingsForm(forms.Form):
    subject_prefix = forms.CharField(
        label=_('Mail Subject Prefix'), required=False,
        help_text=_('Choose a custom prefix for emails from this project.'))


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


class NewRuleForm(forms.Form):
    label = forms.CharField(
        label=_('Label'),
        widget=forms.TextInput(attrs={'placeholder': 'e.g. My Custom Rule'}),
    )
