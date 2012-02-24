"""
sentry.web.forms
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django import forms
from django.contrib.auth.models import User
from django.utils.encoding import force_unicode
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext_lazy as _

from sentry.conf import settings
from sentry.models import Project, ProjectMember
from sentry.interfaces import Http


class RadioFieldRenderer(forms.widgets.RadioFieldRenderer):
    """
    This is identical to Django's builtin widget, except that
    it renders as a Bootstrap2 compatible widget. Would be great if
    we didn't have to create this stupid code, but Django widgets are not
    flexible.
    """
    def render(self):
        return mark_safe(u'\n<div class="inputs-list">%s</div>\n' % u'\n'.join([force_unicode(w) for w in self]))


class UserField(forms.CharField):
    class widget(forms.widgets.TextInput):
        def render(self, name, value, attrs=None):
            if not attrs:
                attrs = {}
            if 'placeholder' not in attrs:
                attrs['placeholder'] = 'username'
            if isinstance(value, int):
                value = unicode(User.objects.get(pk=value))
            return super(UserField.widget, self).render(name, value, attrs)

    def clean(self, value):
        value = super(UserField, self).clean(value)
        if not value:
            return None
        try:
            return User.objects.get(username=value)
        except User.DoesNotExist:
            raise forms.ValidationError(_('Invalid username'))


class RemoveProjectForm(forms.Form):
    removal_type = forms.ChoiceField(choices=(
        ('1', _('Remove all attached events.')),
        ('2', _('Migrate events to another project.')),
        ('3', _('Hide this project.')),
    ), widget=forms.RadioSelect(renderer=RadioFieldRenderer))
    project = forms.ChoiceField(choices=(), required=False)

    def __init__(self, project_list, *args, **kwargs):
        super(RemoveProjectForm, self).__init__(*args, **kwargs)
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
        return Project.objects.get(id=project_id)


class NewProjectForm(forms.ModelForm):
    class Meta:
        fields = ('name',)
        model = Project


class NewProjectAdminForm(forms.ModelForm):
    owner = UserField(required=False)

    class Meta:
        fields = ('name', 'owner')
        model = Project


class EditProjectForm(forms.ModelForm):
    class Meta:
        fields = ('name', 'status', 'public')
        model = Project


class BaseProjectMemberForm(forms.ModelForm):
    class Meta:
        fields = ('type',)
        model = ProjectMember

    def __init__(self, project, *args, **kwargs):
        self.project = project
        super(BaseProjectMemberForm, self).__init__(*args, **kwargs)


EditProjectMemberForm = BaseProjectMemberForm


class NewProjectMemberForm(BaseProjectMemberForm):
    user = UserField()

    class Meta:
        fields = ('user', 'type')
        model = ProjectMember

    def clean_user(self):
        value = self.cleaned_data['user']
        if not value:
            return None

        if self.project.member_set.filter(user=value).exists():
            raise forms.ValidationError(_('User already a member of project'))

        return value


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


class AccountSettingsForm(forms.Form):
    old_password = forms.CharField(label=_("Old password"), widget=forms.PasswordInput)
    email = forms.EmailField()
    first_name = forms.CharField(required=True, label='Name')
    new_password1 = forms.CharField(label=_("New password"), widget=forms.PasswordInput, required=False)
    new_password2 = forms.CharField(label=_("New password confirmation"), widget=forms.PasswordInput, required=False)
    language = forms.ChoiceField(label=_('Language'), choices=settings.LANGUAGES)

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(AccountSettingsForm, self).__init__(*args, **kwargs)

    def clean_new_password2(self):
        password1 = self.cleaned_data.get('new_password1')
        password2 = self.cleaned_data.get('new_password2')
        if password1 and password2:
            if password1 != password2:
                raise forms.ValidationError(_("The two password fields didn't match."))
        return password2

    def clean_old_password(self):
        """
        Validates that the old_password field is correct.
        """
        old_password = self.cleaned_data["old_password"]
        if not self.user.check_password(old_password):
            raise forms.ValidationError(_("Your old password was entered incorrectly. Please enter it again."))
        return old_password

    def save(self, commit=True):
        if self.cleaned_data['new_password2']:
            self.user.set_password(self.cleaned_data['new_password1'])
        self.user.first_name = self.cleaned_data['first_name']
        self.user.email = self.cleaned_data['email']
        if commit:
            self.user.save()
        return self.user
