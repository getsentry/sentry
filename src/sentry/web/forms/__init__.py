"""
sentry.web.forms
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django import forms
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.validators import URLValidator
from django.utils.translation import ugettext_lazy as _

from sentry.models import Project
from sentry.interfaces import Http
from sentry.permissions import can_set_public_projects
from sentry.web.forms.fields import RadioFieldRenderer, UserField


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
    public = forms.BooleanField(required=False, help_text=_('Allow anyone (even anonymous users) to view this project'))
    team = forms.ChoiceField(choices=())
    origins = forms.CharField(widget=forms.Textarea(attrs={'placeholder': 'e.g. http://example.com', 'class': 'span8'}),
        required=False)

    _url_validator = URLValidator(verify_exists=False)

    class Meta:
        fields = ('name', 'public', 'team')
        model = Project

    def __init__(self, request, team_list, data, instance, *args, **kwargs):
        super(EditProjectForm, self).__init__(data=data, instance=instance, *args, **kwargs)
        self.team_list = dict((t.pk, t) for t in team_list.itervalues())
        if not can_set_public_projects(request.user):
            del self.fields['public']
        if len(team_list) == 1 and instance.team == team_list.values()[0]:
            del self.fields['team']
        else:
            team_choices = [(t.pk, t) for t in sorted(self.team_list.values(), key=lambda x: x.name)]
            if not instance.team:
                team_choices.insert(0, ('', '-' * 8))
            elif (instance.team.pk, instance.team) not in team_choices:
                team_choices.insert(1, (instance.team.pk, instance.team))
            self.fields['team'].choices = team_choices
            self.fields['team'].widget.choices = team_choices

    def clean_team(self):
        value = self.cleaned_data.get('team')
        if not value:
            return

        return self.team_list[int(value)]

    def clean_origins(self):
        value = self.cleaned_data.get('origins')
        if not value:
            return value
        values = filter(bool, (v.strip() for v in value.split('\n')))
        for value in values:
            self._url_validator(value)
        return values


class EditProjectAdminForm(EditProjectForm):
    team = forms.ChoiceField(choices=(), required=False)
    owner = UserField(required=False)

    class Meta:
        fields = ('name', 'public', 'team', 'owner')
        model = Project


class ReplayForm(forms.Form):
    url = forms.URLField(widget=forms.TextInput(attrs={'class': 'span8'}))
    method = forms.ChoiceField(choices=((k, k) for k in Http.METHODS))
    data = forms.CharField(required=False, widget=forms.Textarea(attrs={'class': 'span8'}))
    headers = forms.CharField(required=False, widget=forms.Textarea(attrs={'class': 'span8'}))

    def clean_headers(self):
        value = self.cleaned_data.get('headers')
        if not value:
            return

        return dict(line.split(': ') for line in value.split('\n'))


class BaseUserForm(forms.ModelForm):
    email = forms.EmailField()
    first_name = forms.CharField(required=True, label=_('Name'))


class NewUserForm(BaseUserForm):
    create_project = forms.BooleanField(required=False,
        help_text=_("Create a project for this user."))
    send_welcome_mail = forms.BooleanField(required=False,
        help_text=_("Send this user a welcome email which will contain their generated password."))

    class Meta:
        fields = ('first_name', 'username', 'email')
        model = User


class ChangeUserForm(BaseUserForm):
    class Meta:
        fields = ('first_name', 'username', 'email', 'is_active')
        model = User


class RemoveUserForm(forms.Form):
    removal_type = forms.ChoiceField(choices=(
        ('1', _('Disable the account.')),
        ('2', _('Permanently remove the user and their data.')),
    ), widget=forms.RadioSelect(renderer=RadioFieldRenderer))
