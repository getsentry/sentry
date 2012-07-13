"""
sentry.web.forms.projects
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import itertools
from django import forms
from sentry.models import ProjectOption


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

        enabled_tags = ProjectOption.objects.get_value(self.project, 'filters', tag_list)
        self.fields['filters'].initial = enabled_tags

    def save(self):
        filters = self.cleaned_data.get('filters')
        ProjectOption.objects.set_value(self.project, 'tags', filters)
