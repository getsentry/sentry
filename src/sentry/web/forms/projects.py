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
from sentry.models import ProjectOption
from sentry.web.forms.fields import RangeField


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
