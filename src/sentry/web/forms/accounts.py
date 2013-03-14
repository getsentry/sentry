"""
sentry.web.forms.accounts
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django import forms
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils.translation import ugettext_lazy as _

from sentry.conf import settings
from sentry.constants import EMPTY_PASSWORD_VALUES
from sentry.models import UserOption


class RegistrationForm(forms.ModelForm):
    email = forms.EmailField()
    password = forms.CharField(widget=forms.PasswordInput)

    class Meta:
        fields = ('username', 'email')
        model = User

    def clean_email(self):
        value = self.cleaned_data.get('email')
        if not value:
            return
        # We don't really care about why people think they need multiple User accounts with the same
        # email address -- dealwithit.jpg
        if User.objects.filter(email__iexact=value).exists():
            raise forms.ValidationError(_('An account is already registered with that email address.'))
        return value

    def save(self, commit=True):
        user = super(RegistrationForm, self).save(commit=False)
        user.set_password(self.cleaned_data['password'])
        if commit:
            user.save()
        return user


class NotificationSettingsForm(forms.Form):
    alert_email = forms.EmailField(help_text=_('Designate an alternative email address to send email notifications to.'))

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
    new_password = forms.CharField(label=_('New password'), widget=forms.PasswordInput, required=False)

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(AccountSettingsForm, self).__init__(*args, **kwargs)

        # HACK: don't require current password if they don't have one
        if self.user.password in EMPTY_PASSWORD_VALUES:
            del self.fields['old_password']

    def clean_old_password(self):
        """
        Validates that the old_password field is correct.
        """
        old_password = self.cleaned_data["old_password"]
        if not isinstance(authenticate(username=self.user.username, password=old_password), User):
            raise forms.ValidationError(_("Your old password was entered incorrectly. Please enter it again."))
        return old_password

    def save(self, commit=True):
        if self.cleaned_data.get('new_password'):
            self.user.set_password(self.cleaned_data['new_password'])
        self.user.first_name = self.cleaned_data['first_name']
        self.user.email = self.cleaned_data['email']
        if commit:
            self.user.save()

        return self.user


class AppearanceSettingsForm(forms.Form):
    language = forms.ChoiceField(label=_('Language'), choices=settings.LANGUAGES, required=False)
    stacktrace_order = forms.ChoiceField(label=_('Stacktrace order'), choices=(
        ('-1', _('Default (let Sentry decide)')),
        ('1', _('Most recent call last')),
        ('2', _('Most recent call first')),
    ), help_text=_('Choose the default ordering of frames in stacktraces.'), required=False)

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(AppearanceSettingsForm, self).__init__(*args, **kwargs)

    def save(self):
        # if self.cleaned_data['new_password2']:
        #     self.user.set_password(self.cleaned_data['new_password1'])
        # self.user.first_name = self.cleaned_data['first_name']
        # self.user.email = self.cleaned_data['email']
        # if commit:
        #     self.user.save()

        # Save user language
        UserOption.objects.set_value(
            user=self.user,
            project=None,
            key='language',
            value=self.cleaned_data['language'],
        )

        # Save stacktrace options
        UserOption.objects.set_value(
            user=self.user,
            project=None,
            key='stacktrace_order',
            value=self.cleaned_data['stacktrace_order'],
        )

        return self.user


class RecoverPasswordForm(forms.Form):
    user = forms.CharField(label=_('Username'))

    def clean_user(self):
        value = self.cleaned_data.get('user')
        if value:
            try:
                return User.objects.get(username__iexact=value)
            except User.DoesNotExist:
                raise forms.ValidationError(_("We were unable to find a matching user."))
        return None


class ChangePasswordRecoverForm(forms.Form):
    password = forms.CharField(widget=forms.PasswordInput())
