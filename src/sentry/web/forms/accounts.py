"""
sentry.web.forms.accounts
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django import forms
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils.translation import ugettext_lazy as _

from sentry.conf import settings
from sentry.models import UserOption


class NotificationSettingsForm(forms.Form):
    alert_email = forms.EmailField(help_text='Designate an alternative email address to send email notifications to.')

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(NotificationSettingsForm, self).__init__(*args, **kwargs)
        self.fields['alert_email'].initial = UserOption.objects.get_value(
            user=self.user,
            project=None,
            key='alert_email',
            default=user.email,
        )

    def get_title(self):
        return "General"

    def save(self):
        UserOption.objects.set_value(
            user=self.user,
            project=None,
            key='alert_email',
            value=self.cleaned_data['alert_email'],
        )


class AccountSettingsForm(forms.Form):
    old_password = forms.CharField(label=_('Current password'), widget=forms.PasswordInput)
    email = forms.EmailField(label=_('Email'))
    first_name = forms.CharField(required=True, label=_('Name'))
    new_password1 = forms.CharField(label=_('New password'), widget=forms.PasswordInput, required=False)
    new_password2 = forms.CharField(label=_('New password confirmation'), widget=forms.PasswordInput, required=False)
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
        if not isinstance(authenticate(username=self.user.username, password=old_password), User):
            raise forms.ValidationError(_("Your old password was entered incorrectly. Please enter it again."))
        return old_password

    def save(self, commit=True):
        if self.cleaned_data['new_password2']:
            self.user.set_password(self.cleaned_data['new_password1'])
        self.user.first_name = self.cleaned_data['first_name']
        self.user.email = self.cleaned_data['email']
        if commit:
            self.user.save()

        # Save user language
        UserOption.objects.set_value(
            user=self.user,
            project=None,
            key='language',
            value=self.cleaned_data['language'],
        )

        return self.user
