"""
sentry.web.forms
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.constants import HTTP_METHODS
from sentry.models import User, Activity
from sentry.web.forms.fields import RadioFieldRenderer, ReadOnlyTextField


class ReplayForm(forms.Form):
    url = forms.URLField(widget=forms.TextInput(attrs={'class': 'span8'}))
    method = forms.ChoiceField(choices=((k, k) for k in HTTP_METHODS))
    data = forms.CharField(required=False, widget=forms.Textarea(attrs={'class': 'span8'}))
    headers = forms.CharField(required=False, widget=forms.Textarea(attrs={'class': 'span8'}))

    def clean_headers(self):
        value = self.cleaned_data.get('headers')
        if not value:
            return

        return dict(line.split(': ', 1) for line in value.splitlines())


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
    is_staff = forms.BooleanField(required=False, label=_('Admin'),
        help_text=_("Designates whether this user can perform administrative functions."))
    is_superuser = forms.BooleanField(required=False, label=_('Superuser'),
        help_text=_('Designates whether this user has all permissions without '
                    'explicitly assigning them.'))

    class Meta:
        fields = ('first_name', 'username', 'email', 'is_active', 'is_staff',
                  'is_superuser')
        model = User

    def __init__(self, *args, **kwargs):
        super(ChangeUserForm, self).__init__(*args, **kwargs)
        self.user = kwargs['instance']
        if self.user.is_managed:
            self.fields['username'] = ReadOnlyTextField(label="Username (managed)")

    def clean_username(self):
        if self.user.is_managed:
            return self.user.username
        return self.cleaned_data['username']


class RemoveUserForm(forms.Form):
    removal_type = forms.ChoiceField(choices=(
        ('1', _('Disable the account.')),
        ('2', _('Permanently remove the user and their data.')),
    ), widget=forms.RadioSelect(renderer=RadioFieldRenderer))


class TestEmailForm(forms.Form):
    pass


class NewNoteForm(forms.Form):
    text = forms.CharField(widget=forms.Textarea(attrs={'class': 'span8'}))

    def save(self, event, user):
        activity = Activity.objects.create(
            group=event.group, event=event, project=event.project,
            type=Activity.NOTE, user=user,
            data=self.cleaned_data
        )
        activity.send_notification()

        return activity
