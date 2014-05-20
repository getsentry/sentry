"""
sentry.web.forms.accounts
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import pytz

from datetime import datetime

from django import forms
from django.contrib.auth.forms import AuthenticationForm as AuthenticationForm_
from django.utils.translation import ugettext_lazy as _

from six.moves import range

from sentry.constants import LANGUAGES
from sentry.models import UserOption, User
from sentry.utils.auth import find_users


def _get_timezone_choices():
    results = []
    for tz in pytz.common_timezones:
        now = datetime.now(pytz.timezone(tz))
        offset = now.strftime('%z')
        results.append((int(offset), tz, '(GMT%s) %s' % (offset, tz)))
    results.sort()

    for i in range(len(results)):
        results[i] = results[i][1:]
    return results

TIMEZONE_CHOICES = _get_timezone_choices()


class AuthenticationForm(AuthenticationForm_):
    username = forms.CharField(
        label=_('Username or email'), max_length=128)


class RegistrationForm(forms.ModelForm):
    username = forms.EmailField(
        label=_('Email'), max_length=128,
        widget=forms.TextInput(attrs={'placeholder': 'you@example.com'}))
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={'placeholder': 'something super secret'}))

    class Meta:
        fields = ('username',)
        model = User

    def clean_username(self):
        value = self.cleaned_data.get('username')
        if not value:
            return
        if User.objects.filter(username__iexact=value).exists():
            raise forms.ValidationError(_('An account is already registered with that email address.'))
        return value.lower()

    def save(self, commit=True):
        user = super(RegistrationForm, self).save(commit=False)
        user.email = user.username
        user.set_password(self.cleaned_data['password'])
        if commit:
            user.save()
        return user


class NotificationSettingsForm(forms.Form):
    alert_email = forms.EmailField(help_text=_('Designate an alternative email address to send email notifications to.'), required=False)
    subscribe_by_default = forms.ChoiceField(
        choices=(
            ('1', _('Automatically subscribe to notifications for new projects')),
            ('0', _('Do not subscribe to notifications for new projects')),
        ), required=False,
        widget=forms.Select(attrs={'class': 'input-xxlarge'}))
    subscribe_notes = forms.ChoiceField(
        choices=(
            ('1', _('Get notified about new notes')),
            ('0', _('Do not subscribe to note notifications')),
        ), required=False,
        widget=forms.Select(attrs={'class': 'input-xxlarge'}))

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(NotificationSettingsForm, self).__init__(*args, **kwargs)
        self.fields['alert_email'].initial = UserOption.objects.get_value(
            user=self.user,
            project=None,
            key='alert_email',
            default=user.email,
        )
        self.fields['subscribe_by_default'].initial = UserOption.objects.get_value(
            user=self.user,
            project=None,
            key='subscribe_by_default',
            default='1',
        )
        self.fields['subscribe_notes'].initial = UserOption.objects.get_value(
            user=self.user,
            project=None,
            key='subscribe_notes',
            default='1',
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
        UserOption.objects.set_value(
            user=self.user,
            project=None,
            key='subscribe_by_default',
            value=self.cleaned_data['subscribe_by_default'],
        )
        UserOption.objects.set_value(
            user=self.user,
            project=None,
            key='subscribe_notes',
            value=self.cleaned_data['subscribe_notes'],
        )


class AccountSettingsForm(forms.Form):
    username = forms.CharField(label=_('Username'), max_length=128)
    email = forms.EmailField(label=_('Email'))
    first_name = forms.CharField(required=True, label=_('Name'), max_length=30)
    new_password = forms.CharField(label=_('New password'), widget=forms.PasswordInput, required=False)

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(AccountSettingsForm, self).__init__(*args, **kwargs)

        # don't show username field if its the same as their email address
        if self.user.email == self.user.username:
            del self.fields['username']

    def clean_username(self):
        value = self.cleaned_data['username']
        if User.objects.filter(username__iexact=value).exclude(id=self.user.id).exists():
            raise forms.ValidationError(_("That username is already in use."))
        return value

    def save(self, commit=True):
        if self.cleaned_data.get('new_password'):
            self.user.set_password(self.cleaned_data['new_password'])
        self.user.first_name = self.cleaned_data['first_name']

        if self.cleaned_data['email'] != self.user.email:
            new_username = self.user.email == self.user.username
        else:
            new_username = False

        self.user.email = self.cleaned_data['email']

        if self.cleaned_data.get('username'):
            self.user.username = self.cleaned_data['username']
        elif new_username and not User.objects.filter(username__iexact=self.user.email).exists():
            self.user.username = self.user.email

        if commit:
            self.user.save()

        return self.user


class AppearanceSettingsForm(forms.Form):
    language = forms.ChoiceField(
        label=_('Language'), choices=LANGUAGES, required=False,
        widget=forms.Select(attrs={'class': 'input-xlarge'}))
    stacktrace_order = forms.ChoiceField(
        label=_('Stacktrace order'), choices=(
            ('-1', _('Default (let Sentry decide)')),
            ('1', _('Most recent call last')),
            ('2', _('Most recent call first')),
        ), help_text=_('Choose the default ordering of frames in stacktraces.'),
        required=False,
        widget=forms.Select(attrs={'class': 'input-xlarge'}))
    timezone = forms.ChoiceField(
        label=_('Time zone'), choices=TIMEZONE_CHOICES, required=False,
        widget=forms.Select(attrs={'class': 'input-xxlarge'}))

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(AppearanceSettingsForm, self).__init__(*args, **kwargs)

    def save(self):
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

        # Save time zone options
        UserOption.objects.set_value(
            user=self.user,
            project=None,
            key='timezone',
            value=self.cleaned_data['timezone'],
        )

        return self.user


class RecoverPasswordForm(forms.Form):
    user = forms.CharField(label=_('Username or email'))

    def clean_user(self):
        value = self.cleaned_data.get('user')
        if value:
            users = find_users(value)
            if not users:
                raise forms.ValidationError(_("We were unable to find a matching user."))
            if len(users) > 1:
                raise forms.ValidationError(_("Multiple accounts were found matching this email address."))
            return users[0]
        return None


class ChangePasswordRecoverForm(forms.Form):
    password = forms.CharField(widget=forms.PasswordInput())


class ProjectEmailOptionsForm(forms.Form):
    alert = forms.BooleanField(required=False)
    email = forms.EmailField(required=False, widget=forms.HiddenInput())

    def __init__(self, project, user, *args, **kwargs):
        self.project = project
        self.user = user

        super(ProjectEmailOptionsForm, self).__init__(*args, **kwargs)

        is_enabled = UserOption.objects.get_value(
            user, project, 'mail:alert', None)
        if is_enabled is None:
            is_enabled = UserOption.objects.get_value(
                user, None, 'subscribe_by_default', '1') == '1'
        else:
            is_enabled = bool(is_enabled)

        self.fields['alert'].initial = is_enabled
        self.fields['email'].initial = UserOption.objects.get_value(
            user, project, 'mail:email', None)

    def save(self):
        UserOption.objects.set_value(
            self.user, self.project, 'mail:alert',
            int(self.cleaned_data['alert']),
        )
        if self.cleaned_data['email']:
            UserOption.objects.set_value(
                self.user, self.project, 'mail:email',
                self.cleaned_data['email'],
            )
        else:
            UserOption.objects.unset_value(
                self.user, self.project, 'mail:email')
