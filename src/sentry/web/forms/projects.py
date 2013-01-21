"""
sentry.web.forms.projects
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import itertools
from django import forms
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils.translation import ugettext_lazy as _
from sentry.constants import EMPTY_PASSWORD_VALUES
from sentry.models import Project, ProjectOption
from sentry.permissions import can_set_public_projects
from sentry.web.forms.fields import RadioFieldRenderer, UserField, OriginsField, \
  get_team_choices


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


class NewProjectForm(forms.ModelForm):
    name = forms.CharField(label=_('Project Name'), max_length=200,
        widget=forms.TextInput(attrs={'placeholder': _('example.com')}))

    class Meta:
        fields = ('name', 'platform')
        model = Project


class NewProjectAdminForm(NewProjectForm):
    owner = UserField(required=False)

    class Meta:
        fields = ('name', 'platform', 'owner')
        model = Project


class RemoveProjectForm(forms.Form):
    removal_type = forms.ChoiceField(choices=(
        ('1', _('Remove all attached events.')),
        ('2', _('Migrate events to another project.')),
        # ('3', _('Hide this project.')),
    ), widget=forms.RadioSelect(renderer=RadioFieldRenderer))
    project = forms.ChoiceField(choices=(), required=False)
    password = forms.CharField(label=_("Password"), widget=forms.PasswordInput, help_text=_("Confirm your identify by entering your password."))

    def __init__(self, user, project_list, *args, **kwargs):
        super(RemoveProjectForm, self).__init__(*args, **kwargs)
        self.user = user
        if not project_list:
            del self.fields['project']
            self.fields['removal_type'].choices = filter(lambda x: x[0] != '2', self.fields['removal_type'].choices)
        else:
            self.fields['project'].choices = [(p.pk, p.name) for p in project_list]
            self.fields['project'].widget.choices = self.fields['project'].choices

        # HACK: dont require current password if they dont have one
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


class EditProjectForm(forms.ModelForm):
    public = forms.BooleanField(required=False,
        help_text=_('Allow anyone (even anonymous users) to view this project'))
    team = forms.TypedChoiceField(choices=(), coerce=int)
    origins = OriginsField(label=_('Allowed Domains'), required=False,
        help_text=_('Separate multiple entries with a newline.'))

    class Meta:
        fields = ('name', 'platform', 'public', 'team')
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


class EditProjectAdminForm(EditProjectForm):
    team = forms.ChoiceField(choices=(), required=False)
    owner = UserField(required=False)

    class Meta:
        fields = ('name', 'platform', 'public', 'team', 'owner')
        model = Project
