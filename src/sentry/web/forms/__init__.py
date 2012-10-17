"""
sentry.web.forms
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django import forms
from django.contrib.auth.models import User
from django.utils.translation import ugettext_lazy as _

from sentry.interfaces import Http
from sentry.web.forms.fields import RadioFieldRenderer


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
