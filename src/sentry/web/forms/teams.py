"""
sentry.web.forms.teams
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.constants import MEMBER_TYPES
from sentry.models import AccessGroup, Project
from sentry.web.forms.fields import UserField


class BaseAccessGroupForm(forms.ModelForm):
    name = forms.CharField(label=_('Group Name'), max_length=200,
        widget=forms.TextInput(attrs={'placeholder': _('API Team')}))
    type = forms.ChoiceField(label=_('Access Type'), choices=MEMBER_TYPES,
        help_text=_('Members will gain this level of access to all projects assigned to this group.'))

    class Meta:
        fields = ('name', 'type')
        model = AccessGroup


class EditAccessGroupForm(BaseAccessGroupForm):
    pass


class RemoveAccessGroupForm(forms.Form):
    pass


class NewAccessGroupMemberForm(forms.Form):
    user = UserField()


class NewAccessGroupProjectForm(forms.Form):
    project = forms.TypedChoiceField(choices=(), coerce=int)

    def __init__(self, group, *args, **kwargs):
        super(NewAccessGroupProjectForm, self).__init__(*args, **kwargs)
        self.group = group
        self.project_list = dict(
            (p.id, p) for p in Project.objects.filter(
                team=group.team,
            )
        )
        self.fields['project'].choices = [
            (k, p.name) for k, p in sorted(self.project_list.iteritems())
        ]
        self.fields['project'].widget.choices = self.fields['project'].choices

    def clean_project(self):
        value = self.cleaned_data.get('project')
        if not value:
            return None
        try:
            return self.project_list[value]
        except KeyError:
            raise forms.ValidationError(_('Invalid project'))
