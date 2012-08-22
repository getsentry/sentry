"""
sentry.web.forms.projects
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import itertools
from django import forms
from django.utils.translation import ugettext_lazy as _
from sentry.models import Project, ProjectOption
from sentry.web.forms.fields import UserField


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


class NewProjectForm(forms.ModelForm):
    name = forms.CharField(max_length=200, widget=forms.TextInput(attrs={'placeholder': _('e.g. My Project Name')}))
    slug = forms.SlugField(help_text=_('A slug is a URL-safe word and must be unique across all projects.'),
        widget=forms.TextInput(attrs={'placeholder': _('e.g. my-project-name')}))

    class Meta:
        fields = ('name', 'slug')
        model = Project


class NewProjectAdminForm(NewProjectForm):
    owner = UserField(required=False)

    class Meta:
        fields = ('name', 'slug', 'owner')
        model = Project
