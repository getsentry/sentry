"""
sentry.web.forms.accounts
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import pytz

from captcha.fields import ReCaptchaField
from datetime import datetime
from django import forms
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.utils.text import capfirst
from django.utils.translation import ugettext_lazy as _
from six.moves import range

from sentry.constants import LANGUAGES
from sentry.models import UserOption, User
from sentry.utils.auth import find_users
from sentry.web.forms.fields import ReadOnlyTextField


# at runtime we decide whether we should support recaptcha
# TODO(dcramer): there **must** be a better way to do this
if settings.RECAPTCHA_PUBLIC_KEY:
    class CaptchaForm(forms.Form):
        def __init__(self, *args, **kwargs):
            captcha = kwargs.pop('captcha', True)
            super(CaptchaForm, self).__init__(*args, **kwargs)
            if captcha:
                self.fields['captcha'] = ReCaptchaField()

    class CaptchaModelForm(forms.ModelForm):
        def __init__(self, *args, **kwargs):
            captcha = kwargs.pop('captcha', True)
            super(CaptchaModelForm, self).__init__(*args, **kwargs)
            if captcha:
                self.fields['captcha'] = ReCaptchaField()

else:
    class CaptchaForm(forms.Form):
        def __init__(self, *args, **kwargs):
            kwargs.pop('captcha', None)
            super(CaptchaForm, self).__init__(*args, **kwargs)

    class CaptchaModelForm(forms.ModelForm):
        def __init__(self, *args, **kwargs):
            kwargs.pop('captcha', None)
            super(CaptchaModelForm, self).__init__(*args, **kwargs)


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


class AuthenticationForm(CaptchaForm):
    username = forms.CharField(
        label=_('Account'), max_length=128, widget=forms.TextInput(
            attrs={'placeholder': _('username or email'),
        }),
    )
    password = forms.CharField(
        label=_('Password'), widget=forms.PasswordInput(
            attrs={'placeholder': _('password'),
        }),
    )

    error_messages = {
        'invalid_login': _("Please enter a correct %(username)s and password. "
                           "Note that both fields may be case-sensitive."),
        'no_cookies': _("Your Web browser doesn't appear to have cookies "
                        "enabled. Cookies are required for logging in."),
        'inactive': _("This account is inactive."),
    }

    def __init__(self, request=None, *args, **kwargs):
        """
        If request is passed in, the form will validate that cookies are
        enabled. Note that the request (a HttpRequest object) must have set a
        cookie with the key TEST_COOKIE_NAME and value TEST_COOKIE_VALUE before
        running this validation.
        """
        self.request = request
        self.user_cache = None
        super(AuthenticationForm, self).__init__(*args, **kwargs)

        # Set the label for the "username" field.
        UserModel = get_user_model()
        self.username_field = UserModel._meta.get_field(UserModel.USERNAME_FIELD)
        if not self.fields['username'].label:
            self.fields['username'].label = capfirst(self.username_field.verbose_name)

    def clean_username(self):
        value = (self.cleaned_data.get('username') or '').strip()
        if not value:
            return
        return value.lower()

    def clean(self):
        username = self.cleaned_data.get('username')
        password = self.cleaned_data.get('password')

        if username and password:
            self.user_cache = authenticate(username=username,
                                           password=password)
            if self.user_cache is None:
                raise forms.ValidationError(
                    self.error_messages['invalid_login'] % {
                        'username': self.username_field.verbose_name
                    })
        self.check_for_test_cookie()
        return self.cleaned_data

    def check_for_test_cookie(self):
        if self.request and not self.request.session.test_cookie_worked():
            raise forms.ValidationError(self.error_messages['no_cookies'])

    def get_user_id(self):
        if self.user_cache:
            return self.user_cache.id
        return None

    def get_user(self):
        return self.user_cache


class RegistrationForm(CaptchaModelForm):
    username = forms.EmailField(
        label=_('Email'), max_length=128,
        widget=forms.TextInput(attrs={'placeholder': 'you@example.com'}))
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={'placeholder': 'something super secret'}))

    class Meta:
        fields = ('username',)
        model = User

    def clean_username(self):
        value = (self.cleaned_data.get('username') or '').strip()
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


class RecoverPasswordForm(CaptchaForm):
    user = forms.CharField(label=_('Username or email'))

    def clean_user(self):
        value = (self.cleaned_data.get('user') or '').strip()
        if not value:
            return
        users = find_users(value, with_valid_password=False)
        if not users:
            raise forms.ValidationError(_("We were unable to find a matching user."))
        if len(users) > 1:
            raise forms.ValidationError(_("Multiple accounts were found matching this email address."))
        return users[0]


class ChangePasswordRecoverForm(forms.Form):
    password = forms.CharField(widget=forms.PasswordInput())


class NotificationSettingsForm(forms.Form):
    alert_email = forms.EmailField(help_text=_('Designate an alternative email address to send email notifications to.'), required=False)
    subscribe_by_default = forms.ChoiceField(
        label=_('Alerts'),
        choices=(
            ('1', _('Automatically subscribe to notifications for new projects')),
            ('0', _('Do not subscribe to notifications for new projects')),
        ), required=False,
        widget=forms.Select(attrs={'class': 'input-xxlarge'}))
    subscribe_notes = forms.ChoiceField(
        label=_('Notes'),
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
    name = forms.CharField(required=True, label=_('Name'), max_length=30)
    new_password = forms.CharField(label=_('New password'), widget=forms.PasswordInput, required=False)

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(AccountSettingsForm, self).__init__(*args, **kwargs)

        if self.user.is_managed:
            # username and password always managed, email and
            # name optionally managed
            for field in ('email', 'name', 'username'):
                if field == 'username' or field in settings.SENTRY_MANAGED_USER_FIELDS:
                    self.fields[field] = ReadOnlyTextField(label=self.fields[field].label)
            # don't show password field at all
            del self.fields['new_password']

        # don't show username field if its the same as their email address
        if self.user.email == self.user.username:
            del self.fields['username']

    def is_readonly(self):
        if self.user.is_managed:
            return set(('email', 'name')) == set(settings.SENTRY_MANAGED_USER_FIELDS)
        return False

    def _clean_managed_field(self, field):
        if self.user.is_managed and (field == 'username' or
                field in settings.SENTRY_MANAGED_USER_FIELDS):
            return getattr(self.user, field)
        return self.cleaned_data[field]

    def clean_email(self):
        return self._clean_managed_field('email')

    def clean_name(self):
        return self._clean_managed_field('name')

    def clean_username(self):
        value = self._clean_managed_field('username')
        if User.objects.filter(username__iexact=value).exclude(id=self.user.id).exists():
            raise forms.ValidationError(_("That username is already in use."))
        return value

    def save(self, commit=True):
        if self.cleaned_data.get('new_password'):
            self.user.set_password(self.cleaned_data['new_password'])
        self.user.name = self.cleaned_data['name']

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
    clock_24_hours = forms.BooleanField(
        label=_('Use a 24-hour clock'),
        required=False,
    )

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

        # Save clock 24 hours option
        UserOption.objects.set_value(
            user=self.user,
            project=None,
            key='clock_24_hours',
            value=self.cleaned_data['clock_24_hours'],
        )

        return self.user


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
