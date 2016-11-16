"""
sentry.web.forms.accounts
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from datetime import datetime

import pytz
from django import forms
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.utils.text import capfirst
from django.utils.translation import ugettext_lazy as _

from sentry import options
from sentry.auth import password_validation
from sentry.app import ratelimiter
from sentry.constants import LANGUAGES
from sentry.models import (
    Organization, OrganizationStatus, User, UserOption, UserOptionValue
)
from sentry.utils.auth import find_users, logger
from sentry.web.forms.fields import ReadOnlyTextField
from six.moves import range


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


class AuthenticationForm(forms.Form):
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
        'rate_limited': _("You have made too many failed authentication "
                          "attempts. Please try again later."),
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

    def is_rate_limited(self):
        if self._is_ip_rate_limited():
            return True
        if self._is_user_rate_limited():
            return True
        return False

    def _is_ip_rate_limited(self):
        limit = options.get('auth.ip-rate-limit')
        if not limit:
            return False

        ip_address = self.request.META['REMOTE_ADDR']
        return ratelimiter.is_limited(
            'auth:ip:{}'.format(ip_address),
            limit,
        )

    def _is_user_rate_limited(self):
        limit = options.get('auth.user-rate-limit')
        if not limit:
            return False

        username = self.cleaned_data.get('username')
        if not username:
            return False

        return ratelimiter.is_limited(
            u'auth:username:{}'.format(username),
            limit,
        )

    def clean(self):
        username = self.cleaned_data.get('username')

        if self.is_rate_limited():
            logger.info('user.auth.rate-limited', extra={
                'ip_address': self.request.META['REMOTE_ADDR'],
                'username': username,
            })
            raise forms.ValidationError(self.error_messages['rate_limited'])

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
        value = (self.cleaned_data.get('username') or '').strip()
        if not value:
            return
        if User.objects.filter(username__iexact=value).exists():
            raise forms.ValidationError(_('An account is already registered with that email address.'))
        return value.lower()

    def clean_password(self):
        password = self.cleaned_data['password']
        password_validation.validate_password(password)
        return password

    def save(self, commit=True):
        user = super(RegistrationForm, self).save(commit=False)
        user.email = user.username
        user.set_password(self.cleaned_data['password'])
        if commit:
            user.save()
        return user


class RecoverPasswordForm(forms.Form):
    user = forms.CharField(label=_('Username or email'))

    def clean_user(self):
        value = (self.cleaned_data.get('user') or '').strip()
        if not value:
            return
        users = find_users(value, with_valid_password=False)
        if not users:
            raise forms.ValidationError(_("We were unable to find a matching user."))

        users = [u for u in users if not u.is_managed]
        if not users:
            raise forms.ValidationError(_("The account you are trying to recover is managed and does not support password recovery."))

        if len(users) > 1:
            raise forms.ValidationError(_("Multiple accounts were found matching this email address."))
        return users[0]


class ChangePasswordRecoverForm(forms.Form):
    password = forms.CharField(widget=forms.PasswordInput())

    def clean_password(self):
        password = self.cleaned_data['password']
        password_validation.validate_password(password)
        return password


class EmailForm(forms.Form):
    primary_email = forms.EmailField(label=_('Primary Email'))

    alt_email = forms.EmailField(
        label=_('New Email'),
        required=False,
        help_text='Designate an alternative email for this account',
    )

    password = forms.CharField(
        label=_('Current password'),
        widget=forms.PasswordInput(),
        help_text=_('You will need to enter your current account password to make changes.'),
        required=True,
    )

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(EmailForm, self).__init__(*args, **kwargs)

        needs_password = user.has_usable_password()

        if not needs_password:
            del self.fields['password']

    def save(self, commit=True):

        if self.cleaned_data['primary_email'] != self.user.email:
            new_username = self.user.email == self.user.username
        else:
            new_username = False

        self.user.email = self.cleaned_data['primary_email']

        if new_username and not User.objects.filter(username__iexact=self.user.email).exists():
            self.user.username = self.user.email

        if commit:
            self.user.save()

        return self.user

    def clean_password(self):
        value = self.cleaned_data.get('password')
        if value and not self.user.check_password(value):
            raise forms.ValidationError(_('The password you entered is not correct.'))
        elif not value:
            raise forms.ValidationError(_('You must confirm your current password to make changes.'))
        return value


class AccountSettingsForm(forms.Form):
    name = forms.CharField(required=True, label=_('Name'), max_length=30)
    username = forms.CharField(label=_('Username'), max_length=128)
    email = forms.EmailField(label=_('Email'))
    new_password = forms.CharField(
        label=_('New password'),
        widget=forms.PasswordInput(),
        required=False,
        # help_text=password_validation.password_validators_help_text_html(),
    )
    password = forms.CharField(
        label=_('Current password'),
        widget=forms.PasswordInput(),
        help_text='You will need to enter your current account password to make changes.',
        required=False,
    )

    def __init__(self, user, request, *args, **kwargs):
        self.user = user
        self.request = request
        super(AccountSettingsForm, self).__init__(*args, **kwargs)

        needs_password = user.has_usable_password()

        if self.user.is_managed:
            # username and password always managed, email and
            # name optionally managed
            for field in ('email', 'name', 'username'):
                if field == 'username' or field in settings.SENTRY_MANAGED_USER_FIELDS:
                    self.fields[field] = ReadOnlyTextField(label=self.fields[field].label)
                if field == 'email':
                    needs_password = False

            del self.fields['new_password']

        # don't show username field if its the same as their email address
        if self.user.email == self.user.username:
            del self.fields['username']

        if not needs_password:
            del self.fields['password']

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

    def clean_password(self):
        value = self.cleaned_data.get('password')
        if value and not self.user.check_password(value):
            raise forms.ValidationError('The password you entered is not correct.')
        elif not value and (
            self.cleaned_data.get('email', self.user.email) != self.user.email
            or self.cleaned_data.get('new_password')
        ):
            raise forms.ValidationError('You must confirm your current password to make changes.')
        return value

    def clean_new_password(self):
        new_password = self.cleaned_data.get('new_password')
        if new_password:
            password_validation.validate_password(new_password)
        return new_password

    def save(self, commit=True):
        if self.cleaned_data.get('new_password'):
            self.user.set_password(self.cleaned_data['new_password'])
            self.user.refresh_session_nonce(self.request)

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


class NotificationReportSettingsForm(forms.Form):
    organizations = forms.ModelMultipleChoiceField(
        queryset=Organization.objects.none(),
        required=False,
        widget=forms.CheckboxSelectMultiple(),
    )

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(NotificationReportSettingsForm, self).__init__(*args, **kwargs)

        org_queryset = Organization.objects.filter(
            status=OrganizationStatus.VISIBLE,
            member_set__user=user,
        )

        disabled_orgs = set(UserOption.objects.get_value(
            user=user,
            project=None,
            key='reports:disabled-organizations',
            default=[],
        ))

        self.fields['organizations'].queryset = org_queryset
        self.fields['organizations'].initial = [
            o.id for o in org_queryset
            if o.id not in disabled_orgs
        ]

    def save(self):
        enabled_orgs = set((
            o.id for o in self.cleaned_data.get('organizations')
        ))
        all_orgs = set(self.fields['organizations'].queryset.values_list('id', flat=True))
        UserOption.objects.set_value(
            user=self.user,
            project=None,
            key='reports:disabled-organizations',
            value=list(all_orgs.difference(enabled_orgs)),
        )


class NotificationSettingsForm(forms.Form):
    alert_email = forms.EmailField(
        label=_('Email'),
        help_text=_('Designate an alternative email address to send email notifications to.'),
        required=False
    )

    subscribe_by_default = forms.BooleanField(
        label=_('Automatically subscribe to alerts for new projects'),
        help_text=_("When enabled, you'll automatically subscribe to alerts when you create or join a project."),
        required=False,
    )

    workflow_notifications = forms.BooleanField(
        label=_('Automatically subscribe to workflow notifications for new projects'),
        help_text=_("When enabled, you'll automatically subscribe to workflow notifications when you create or join a project."),
        required=False,
    )
    self_notifications = forms.BooleanField(
        label=_('Receive notifications about my own activity'),
        help_text=_('Enable this if you wish to receive emails for your own actions, as well as others.'),
        required=False,
    )

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(NotificationSettingsForm, self).__init__(*args, **kwargs)

        self.fields['alert_email'].initial = UserOption.objects.get_value(
            user=self.user,
            project=None,
            key='alert_email',
            default=user.email,
        )
        self.fields['subscribe_by_default'].initial = (
            UserOption.objects.get_value(
                user=self.user,
                project=None,
                key='subscribe_by_default',
                default='1',
            ) == '1'
        )

        self.fields['workflow_notifications'].initial = (
            UserOption.objects.get_value(
                user=self.user,
                project=None,
                key='workflow:notifications',
                default=UserOptionValue.all_conversations,
            ) == UserOptionValue.all_conversations
        )

        self.fields['self_notifications'].initial = UserOption.objects.get_value(
            user=self.user,
            project=None,
            key='self_notifications',
            default='0'
        ) == '1'

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
            value='1' if self.cleaned_data['subscribe_by_default'] else '0',
        )

        UserOption.objects.set_value(
            user=self.user,
            project=None,
            key='self_notifications',
            value='1' if self.cleaned_data['self_notifications'] else '0',
        )

        if self.cleaned_data.get('workflow_notifications') is True:
            UserOption.objects.set_value(
                user=self.user,
                project=None,
                key='workflow:notifications',
                value=UserOptionValue.all_conversations,
            )
        else:
            UserOption.objects.set_value(
                user=self.user,
                project=None,
                key='workflow:notifications',
                value=UserOptionValue.participating_only,
            )


class ProjectEmailOptionsForm(forms.Form):
    alert = forms.BooleanField(required=False)
    workflow = forms.BooleanField(required=False)
    email = forms.ChoiceField(label="", choices=(), required=False,
        widget=forms.Select())

    def __init__(self, project, user, *args, **kwargs):
        self.project = project
        self.user = user

        super(ProjectEmailOptionsForm, self).__init__(*args, **kwargs)

        has_alerts = project.is_user_subscribed_to_mail_alerts(user)
        has_workflow = project.is_user_subscribed_to_workflow(user)

        # This allows users who have entered an alert_email value or have specified an email
        # for notifications to keep their settings
        emails = [e.email for e in user.get_verified_emails()]
        alert_email = UserOption.objects.get_value(user=self.user, project=None, key='alert_email', default=None)
        specified_email = UserOption.objects.get_value(user, project, 'mail:email', None)
        emails.extend([user.email, alert_email, specified_email])

        choices = [(email, email) for email in set(emails) if email is not None]
        self.fields['email'].choices = choices

        self.fields['alert'].initial = has_alerts
        self.fields['workflow'].initial = has_workflow
        self.fields['email'].initial = specified_email or alert_email or user.email

    def save(self):
        UserOption.objects.set_value(
            self.user, self.project, 'mail:alert',
            int(self.cleaned_data['alert']),
        )

        UserOption.objects.set_value(
            self.user, self.project, 'workflow:notifications',
            UserOptionValue.all_conversations if self.cleaned_data['workflow'] else UserOptionValue.participating_only,
        )

        if self.cleaned_data['email']:
            UserOption.objects.set_value(
                self.user, self.project, 'mail:email',
                self.cleaned_data['email'],
            )
        else:
            UserOption.objects.unset_value(
                self.user, self.project, 'mail:email')


class TwoFactorForm(forms.Form):
    otp = forms.CharField(
        label=_('One-time password'), max_length=20, widget=forms.TextInput(
            attrs={'placeholder': _('Code from authenticator'),
                   'autofocus': True,
        }),
    )


class ConfirmPasswordForm(forms.Form):
    password = forms.CharField(
        label=_('Sentry account password'),
        widget=forms.PasswordInput(),
        help_text='You will need to enter your current Sentry account password to make changes.',
        required=True,
    )

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(ConfirmPasswordForm, self).__init__(*args, **kwargs)

        needs_password = user.has_usable_password()

        if not needs_password:
            del self.fields['password']
