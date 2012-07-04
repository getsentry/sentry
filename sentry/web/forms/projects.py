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
    tags = forms.MultipleChoiceField(choices=(), widget=forms.CheckboxSelectMultiple(), required=False)

    def __init__(self, project, tag_list, *args, **kwargs):
        self.project = project
        super(ProjectTagsForm, self).__init__(*args, **kwargs)

        self.fields['tags'].choices = tuple(
            (k, '%s (%s)' % (k.replace('_', ' ').title(), k))
            for k in itertools.imap(unicode, tag_list)
        )
        self.fields['tags'].widget.choices = self.fields['tags'].choices

        enabled_tags = ProjectOption.objects.get_value(self.project, 'tags', tag_list)
        self.fields['tags'].initial = enabled_tags

    def save(self):
        tags = self.cleaned_data.get('tags')
        ProjectOption.objects.set_value(self.project, 'tags', tags)
