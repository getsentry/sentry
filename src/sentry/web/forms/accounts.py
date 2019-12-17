from __future__ import absolute_import

import pytz
import six

from datetime import datetime
from django import forms
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.db.models import Q
from django.utils.text import capfirst, mark_safe
from django.utils.translation import ugettext_lazy as _

from sentry import newsletter, options
from sentry.auth import password_validation
from sentry.app import ratelimiter
from sentry.constants import LANGUAGES
from sentry.models import Organization, OrganizationStatus, User, UserOption, UserOptionValue
from sentry.security import capture_security_activity
from sentry.utils.auth import find_users, logger
from sentry.web.forms.fields import CustomTypedChoiceField, ReadOnlyTextField, AllowedEmailField
from six.moves import range


def _get_timezone_choices():
    results = []
    for tz in pytz.common_timezones:
        now = datetime.now(pytz.timezone(tz))
        offset = now.strftime("%z")
        results.append((int(offset), tz, "(UTC%s) %s" % (offset, tz)))
    results.sort()

    for i in range(len(results)):
        results[i] = results[i][1:]
    return results


TIMEZONE_CHOICES = _get_timezone_choices()


class AuthenticationForm(forms.Form):
    username = forms.CharField(
        label=_("Account"),
        max_length=128,
        widget=forms.TextInput(attrs={"placeholder": _("username or email"), "tabindex": 1}),
    )
    password = forms.CharField(
        label=_("Password"),
        widget=forms.PasswordInput(attrs={"placeholder": _("password"), "tabindex": 2}),
    )

    error_messages = {
        "invalid_login": _(
            "Please enter a correct %(username)s and password. "
            "Note that both fields may be case-sensitive."
        ),
        "rate_limited": _(
            "You have made too many failed authentication " "attempts. Please try again later."
        ),
        "no_cookies": _(
            "Your Web browser doesn't appear to have cookies "
            "enabled. Cookies are required for logging in."
        ),
        "inactive": _("This account is inactive."),
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
        if not self.fields["username"].label:
            self.fields["username"].label = capfirst(self.username_field.verbose_name)

    def clean_username(self, value=None):
        if not value:
            value = self.cleaned_data.get("username") or ""
        value = value.strip(" \n\t\r\0")
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
        limit = options.get("auth.ip-rate-limit")
        if not limit:
            return False

        ip_address = self.request.META["REMOTE_ADDR"]
        return ratelimiter.is_limited(u"auth:ip:{}".format(ip_address), limit)

    def _is_user_rate_limited(self):
        limit = options.get("auth.user-rate-limit")
        if not limit:
            return False

        username = self.cleaned_data.get("username")
        if not username:
            return False

        return ratelimiter.is_limited(u"auth:username:{}".format(username), limit)

    def clean(self):
        username = self.cleaned_data.get("username")
        password = self.cleaned_data.get("password")

        if not (username and password):
            raise forms.ValidationError(
                self.error_messages["invalid_login"]
                % {"username": self.username_field.verbose_name}
            )

        if self.is_rate_limited():
            logger.info(
                "user.auth.rate-limited",
                extra={"ip_address": self.request.META["REMOTE_ADDR"], "username": username},
            )
            raise forms.ValidationError(self.error_messages["rate_limited"])

        self.user_cache = authenticate(username=username, password=password)
        if self.user_cache is None:
            raise forms.ValidationError(
                self.error_messages["invalid_login"]
                % {"username": self.username_field.verbose_name}
            )

        self.check_for_test_cookie()
        return self.cleaned_data

    def check_for_test_cookie(self):
        if self.request and not self.request.session.test_cookie_worked():
            raise forms.ValidationError(self.error_messages["no_cookies"])

    def get_user_id(self):
        if self.user_cache:
            return self.user_cache.id
        return None

    def get_user(self):
        return self.user_cache


class PasswordlessRegistrationForm(forms.ModelForm):
    name = forms.CharField(
        label=_("Name"),
        max_length=30,
        widget=forms.TextInput(attrs={"placeholder": "Jane Bloggs"}),
        required=True,
    )
    username = AllowedEmailField(
        label=_("Email"),
        max_length=128,
        widget=forms.TextInput(attrs={"placeholder": "you@example.com"}),
        required=True,
    )
    subscribe = CustomTypedChoiceField(
        coerce=lambda x: six.text_type(x) == u"1",
        label=_("Email updates"),
        choices=(
            (1, "Yes, I would like to receive updates via email"),
            (0, "No, I'd prefer not to receive these updates"),
        ),
        widget=forms.RadioSelect,
        required=True,
        initial=False,
    )

    def __init__(self, *args, **kwargs):
        super(PasswordlessRegistrationForm, self).__init__(*args, **kwargs)
        if not newsletter.is_enabled():
            del self.fields["subscribe"]
        else:
            # NOTE: the text here is duplicated within the ``NewsletterConsent`` component
            # in the UI
            notice = (
                "We'd love to keep you updated via email with product and feature "
                "announcements, promotions, educational materials, and events. "
                "Our updates focus on relevant information, and we'll never sell "
                "your data to third parties. See our "
                '<a href="{privacy_link}">Privacy Policy</a> for more details.'
            )
            self.fields["subscribe"].help_text = mark_safe(
                notice.format(privacy_link=settings.PRIVACY_URL)
            )

    class Meta:
        fields = ("username", "name")
        model = User

    def clean_username(self):
        value = (self.cleaned_data.get("username") or "").strip()
        if not value:
            return
        if User.objects.filter(username__iexact=value).exists():
            raise forms.ValidationError(
                _("An account is already registered with that email address.")
            )
        return value.lower()

    def save(self, commit=True):
        user = super(PasswordlessRegistrationForm, self).save(commit=False)
        user.email = user.username
        if commit:
            user.save()
            if self.cleaned_data.get("subscribe"):
                newsletter.create_or_update_subscriptions(
                    user, list_ids=newsletter.get_default_list_ids()
                )
        return user


class RegistrationForm(PasswordlessRegistrationForm):
    password = forms.CharField(
        required=True, widget=forms.PasswordInput(attrs={"placeholder": "something super secret"})
    )

    def clean_password(self):
        password = self.cleaned_data["password"]
        password_validation.validate_password(password)
        return password

    def save(self, commit=True):
        user = super(RegistrationForm, self).save(commit=False)
        user.set_password(self.cleaned_data["password"])
        if commit:
            user.save()
            if self.cleaned_data.get("subscribe"):
                newsletter.create_or_update_subscriptions(
                    user, list_ids=newsletter.get_default_list_ids()
                )
        return user


class RecoverPasswordForm(forms.Form):
    user = forms.CharField(
        label=_("Account"),
        max_length=128,
        widget=forms.TextInput(attrs={"placeholder": _("username or email")}),
    )

    def clean_user(self):
        value = (self.cleaned_data.get("user") or "").strip()
        if not value:
            return
        users = find_users(value, with_valid_password=False)
        if not users:
            return

        # If we find more than one user, we likely matched on email address.
        # We silently bail here as we emailing the 'wrong' person isn't great.
        # They will have to retry with their username which is guaranteed
        # to be unique
        if len(users) > 1:
            return

        users = [u for u in users if not u.is_managed]
        if not users:
            raise forms.ValidationError(
                _(
                    "The account you are trying to recover is managed and does not support password recovery."
                )
            )
        return users[0]


class ChangePasswordRecoverForm(forms.Form):
    password = forms.CharField(widget=forms.PasswordInput())

    def clean_password(self):
        password = self.cleaned_data["password"]
        password_validation.validate_password(password)
        return password


class EmailForm(forms.Form):
    alt_email = AllowedEmailField(
        label=_("New Email"),
        required=False,
        help_text="Designate an alternative email for this account",
    )

    password = forms.CharField(
        label=_("Current password"),
        widget=forms.PasswordInput(),
        help_text=_("You will need to enter your current account password to make changes."),
        required=True,
    )

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(EmailForm, self).__init__(*args, **kwargs)

        needs_password = user.has_usable_password()

        if not needs_password:
            del self.fields["password"]

    def clean_password(self):
        value = self.cleaned_data.get("password")
        if value and not self.user.check_password(value):
            raise forms.ValidationError(_("The password you entered is not correct."))
        elif not value:
            raise forms.ValidationError(
                _("You must confirm your current password to make changes.")
            )
        return value


class AccountSettingsForm(forms.Form):
    name = forms.CharField(required=True, label=_("Name"), max_length=30)
    username = forms.CharField(label=_("Username"), max_length=128)
    email = AllowedEmailField(label=_("Email"))
    new_password = forms.CharField(
        label=_("New password"),
        widget=forms.PasswordInput(),
        required=False,
        # help_text=password_validation.password_validators_help_text_html(),
    )
    verify_new_password = forms.CharField(
        label=_("Verify new password"), widget=forms.PasswordInput(), required=False
    )
    password = forms.CharField(
        label=_("Current password"),
        widget=forms.PasswordInput(),
        help_text="You will need to enter your current account password to make changes.",
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
            for field in ("email", "name", "username"):
                if field == "username" or field in settings.SENTRY_MANAGED_USER_FIELDS:
                    self.fields[field] = ReadOnlyTextField(label=self.fields[field].label)
                if field == "email":
                    needs_password = False

            del self.fields["new_password"]
            del self.fields["verify_new_password"]

        # don't show username field if its the same as their email address
        if self.user.email == self.user.username:
            del self.fields["username"]

        if not needs_password:
            del self.fields["password"]

    def is_readonly(self):
        if self.user.is_managed:
            return set(("email", "name")) == set(settings.SENTRY_MANAGED_USER_FIELDS)
        return False

    def _clean_managed_field(self, field):
        if self.user.is_managed and (
            field == "username" or field in settings.SENTRY_MANAGED_USER_FIELDS
        ):
            return getattr(self.user, field)
        return self.cleaned_data[field]

    def clean_email(self):
        value = self._clean_managed_field("email").lower()
        if self.user.email.lower() == value:
            return value
        if (
            User.objects.filter(Q(email__iexact=value) | Q(username__iexact=value))
            .exclude(id=self.user.id)
            .exists()
        ):
            raise forms.ValidationError(
                _("There was an error adding %s: that email is already in use")
                % self.cleaned_data["email"]
            )
        return value

    def clean_name(self):
        return self._clean_managed_field("name")

    def clean_username(self):
        value = self._clean_managed_field("username")
        if User.objects.filter(username__iexact=value).exclude(id=self.user.id).exists():
            raise forms.ValidationError(_("That username is already in use."))
        return value

    def clean_password(self):
        value = self.cleaned_data.get("password")
        if value and not self.user.check_password(value):
            raise forms.ValidationError("The password you entered is not correct.")
        elif not value and (
            self.cleaned_data.get("email", self.user.email) != self.user.email
            or self.cleaned_data.get("new_password")
        ):
            raise forms.ValidationError("You must confirm your current password to make changes.")
        return value

    def clean_verify_new_password(self):
        new_password = self.cleaned_data.get("new_password")

        if new_password:
            verify_new_password = self.cleaned_data.get("verify_new_password")
            if verify_new_password is None:
                raise forms.ValidationError("You must verify your new password.")

            if new_password != verify_new_password:
                raise forms.ValidationError("Your new password and verify new password must match.")

            return verify_new_password

    def clean_new_password(self):
        new_password = self.cleaned_data.get("new_password")
        if new_password:
            password_validation.validate_password(new_password)
        return new_password

    def save(self, commit=True):
        if self.cleaned_data.get("new_password"):
            self.user.set_password(self.cleaned_data["new_password"])
            self.user.refresh_session_nonce(self.request)

            capture_security_activity(
                account=self.user,
                type="password-changed",
                actor=self.request.user,
                ip_address=self.request.META["REMOTE_ADDR"],
                send_email=True,
            )

        self.user.name = self.cleaned_data["name"]

        if self.cleaned_data["email"] != self.user.email:
            new_username = self.user.email == self.user.username
        else:
            new_username = False

        self.user.email = self.cleaned_data["email"]

        if self.cleaned_data.get("username"):
            self.user.username = self.cleaned_data["username"]
        elif new_username and not User.objects.filter(username__iexact=self.user.email).exists():
            self.user.username = self.user.email

        if commit:
            self.user.save()

        return self.user


class AppearanceSettingsForm(forms.Form):
    language = forms.ChoiceField(
        label=_("Language"),
        choices=LANGUAGES,
        required=False,
        widget=forms.Select(attrs={"class": "input-xlarge"}),
    )
    stacktrace_order = forms.ChoiceField(
        label=_("Stacktrace order"),
        choices=(
            ("-1", _("Default (let Sentry decide)")),
            ("1", _("Most recent call last")),
            ("2", _("Most recent call first")),
        ),
        help_text=_("Choose the default ordering of frames in stacktraces."),
        required=False,
        widget=forms.Select(attrs={"class": "input-xlarge"}),
    )
    timezone = forms.ChoiceField(
        label=_("Time zone"),
        choices=TIMEZONE_CHOICES,
        required=False,
        widget=forms.Select(attrs={"class": "input-xxlarge"}),
    )
    clock_24_hours = forms.BooleanField(label=_("Use a 24-hour clock"), required=False)

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(AppearanceSettingsForm, self).__init__(*args, **kwargs)

    def save(self):
        # Save user language
        UserOption.objects.set_value(
            user=self.user, key="language", value=self.cleaned_data["language"]
        )

        # Save stacktrace options
        UserOption.objects.set_value(
            user=self.user, key="stacktrace_order", value=self.cleaned_data["stacktrace_order"]
        )

        # Save time zone options
        UserOption.objects.set_value(
            user=self.user, key="timezone", value=self.cleaned_data["timezone"]
        )

        # Save clock 24 hours option
        UserOption.objects.set_value(
            user=self.user, key="clock_24_hours", value=self.cleaned_data["clock_24_hours"]
        )

        return self.user


class NotificationReportSettingsForm(forms.Form):
    organizations = forms.ModelMultipleChoiceField(
        queryset=Organization.objects.none(), required=False, widget=forms.CheckboxSelectMultiple()
    )

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(NotificationReportSettingsForm, self).__init__(*args, **kwargs)

        org_queryset = Organization.objects.filter(
            status=OrganizationStatus.VISIBLE, member_set__user=user
        )

        disabled_orgs = set(
            UserOption.objects.get_value(
                user=user, key="reports:disabled-organizations", default=[]
            )
        )

        self.fields["organizations"].queryset = org_queryset
        self.fields["organizations"].initial = [
            o.id for o in org_queryset if o.id not in disabled_orgs
        ]

    def save(self):
        enabled_orgs = set((o.id for o in self.cleaned_data.get("organizations")))
        all_orgs = set(self.fields["organizations"].queryset.values_list("id", flat=True))
        UserOption.objects.set_value(
            user=self.user,
            key="reports:disabled-organizations",
            value=list(all_orgs.difference(enabled_orgs)),
        )


class NotificationDeploySettingsForm(forms.Form):
    CHOICES = [
        (UserOptionValue.all_deploys, _("All deploys")),
        (UserOptionValue.committed_deploys_only, _("Deploys with your commits")),
        (UserOptionValue.no_deploys, _("Never")),
    ]

    notifications = forms.ChoiceField(choices=CHOICES, required=False, widget=forms.RadioSelect())

    def __init__(self, user, organization, *args, **kwargs):
        self.user = user
        self.organization = organization
        super(NotificationDeploySettingsForm, self).__init__(*args, **kwargs)
        self.fields["notifications"].label = ""  # hide the label

        deploy_setting = UserOption.objects.get_value(
            user=user,
            organization=self.organization,
            key="deploy-emails",
            default=UserOptionValue.committed_deploys_only,
        )

        self.fields["notifications"].initial = deploy_setting

    def save(self):
        value = self.data.get(u"{}-notifications".format(self.prefix), None)
        if value is not None:
            UserOption.objects.set_value(
                user=self.user, organization=self.organization, key="deploy-emails", value=value
            )


class NotificationSettingsForm(forms.Form):
    alert_email = AllowedEmailField(
        label=_("Email"),
        help_text=_("Designate an alternative email address to send email notifications to."),
        required=False,
    )

    subscribe_by_default = forms.BooleanField(
        label=_("Automatically subscribe to alerts for new projects"),
        help_text=_(
            "When enabled, you'll automatically subscribe to alerts when you create or join a project."
        ),
        required=False,
    )

    workflow_notifications = forms.ChoiceField(
        label=_("Preferred workflow subscription level for new projects"),
        choices=[
            (UserOptionValue.all_conversations, "Receive workflow updates for all issues."),
            (
                UserOptionValue.participating_only,
                "Receive workflow updates only for issues that I am participating in or have subscribed to.",
            ),
            (UserOptionValue.no_conversations, "Never receive workflow updates."),
        ],
        help_text=_(
            "This will be automatically set as your subscription preference when you create or join a project. It has no effect on existing projects."
        ),
        required=False,
    )

    self_notifications = forms.BooleanField(
        label=_("Receive notifications about my own activity"),
        help_text=_(
            "Enable this if you wish to receive emails for your own actions, as well as others."
        ),
        required=False,
    )

    self_assign_issue = forms.BooleanField(
        label=_("Claim unassigned issues when resolving them"),
        help_text=_(
            "When enabled, you'll automatically be assigned to unassigned issues when marking them as resolved."
        ),
        required=False,
    )

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(NotificationSettingsForm, self).__init__(*args, **kwargs)

        self.fields["alert_email"].initial = UserOption.objects.get_value(
            user=self.user, key="alert_email", default=user.email
        )
        self.fields["subscribe_by_default"].initial = (
            UserOption.objects.get_value(user=self.user, key="subscribe_by_default", default="1")
            == "1"
        )

        self.fields["workflow_notifications"].initial = UserOption.objects.get_value(
            user=self.user,
            key="workflow:notifications",
            default=UserOptionValue.participating_only,
            project=None,
        )

        self.fields["self_notifications"].initial = (
            UserOption.objects.get_value(user=self.user, key="self_notifications", default="0")
            == "1"
        )

        self.fields["self_assign_issue"].initial = (
            UserOption.objects.get_value(user=self.user, key="self_assign_issue", default="0")
            == "1"
        )

    def get_title(self):
        return "General"

    def save(self):
        UserOption.objects.set_value(
            user=self.user, key="alert_email", value=self.cleaned_data["alert_email"]
        )

        UserOption.objects.set_value(
            user=self.user,
            key="subscribe_by_default",
            value="1" if self.cleaned_data["subscribe_by_default"] else "0",
        )

        UserOption.objects.set_value(
            user=self.user,
            key="self_notifications",
            value="1" if self.cleaned_data["self_notifications"] else "0",
        )

        UserOption.objects.set_value(
            user=self.user,
            key="self_assign_issue",
            value="1" if self.cleaned_data["self_assign_issue"] else "0",
        )

        workflow_notifications_value = self.cleaned_data.get("workflow_notifications")
        if not workflow_notifications_value:
            UserOption.objects.unset_value(
                user=self.user, key="workflow:notifications", project=None
            )
        else:
            UserOption.objects.set_value(
                user=self.user,
                key="workflow:notifications",
                value=workflow_notifications_value,
                project=None,
            )


class ProjectEmailOptionsForm(forms.Form):
    alert = forms.BooleanField(required=False)
    workflow = forms.ChoiceField(
        choices=[
            (UserOptionValue.no_conversations, "Nothing"),
            (UserOptionValue.participating_only, "Participating"),
            (UserOptionValue.all_conversations, "Everything"),
        ]
    )
    email = forms.ChoiceField(label="", choices=(), required=False, widget=forms.Select())

    def __init__(self, project, user, *args, **kwargs):
        self.project = project
        self.user = user

        super(ProjectEmailOptionsForm, self).__init__(*args, **kwargs)

        has_alerts = project.is_user_subscribed_to_mail_alerts(user)

        # This allows users who have entered an alert_email value or have specified an email
        # for notifications to keep their settings
        emails = [e.email for e in user.get_verified_emails()]
        alert_email = UserOption.objects.get_value(self.user, "alert_email")
        specified_email = UserOption.objects.get_value(self.user, "mail:email", project=project)
        emails.extend([user.email, alert_email, specified_email])

        choices = [(email, email) for email in sorted(set(emails)) if email]

        self.fields["email"].choices = choices

        self.fields["alert"].initial = has_alerts
        self.fields["workflow"].initial = UserOption.objects.get_value(
            user=self.user,
            project=self.project,
            key="workflow:notifications",
            default=UserOption.objects.get_value(
                user=self.user,
                project=None,
                key="workflow:notifications",
                default=UserOptionValue.participating_only,
            ),
        )
        self.fields["email"].initial = specified_email or alert_email or user.email

    def save(self):
        UserOption.objects.set_value(
            user=self.user,
            key="mail:alert",
            value=int(self.cleaned_data["alert"]),
            project=self.project,
        )

        UserOption.objects.set_value(
            user=self.user,
            key="workflow:notifications",
            value=self.cleaned_data["workflow"],
            project=self.project,
        )

        if self.cleaned_data["email"]:
            UserOption.objects.set_value(
                user=self.user,
                key="mail:email",
                value=self.cleaned_data["email"],
                project=self.project,
            )
        else:
            UserOption.objects.unset_value(self.user, self.project, "mail:email")


class TwoFactorForm(forms.Form):
    otp = forms.CharField(
        label=_("Authenticator code"),
        max_length=20,
        widget=forms.TextInput(
            attrs={"placeholder": _("Authenticator or recovery code"), "autofocus": True}
        ),
    )


class ConfirmPasswordForm(forms.Form):
    password = forms.CharField(
        label=_("Sentry account password"),
        widget=forms.PasswordInput(),
        help_text="You will need to enter your current Sentry account password to make changes.",
        required=True,
    )

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(ConfirmPasswordForm, self).__init__(*args, **kwargs)

        needs_password = user.has_usable_password()

        if not needs_password:
            del self.fields["password"]

    def clean_password(self):
        value = self.cleaned_data.get("password")
        if value and not self.user.check_password(value):
            raise forms.ValidationError(_("The password you entered is not correct."))
        elif not value:
            raise forms.ValidationError(
                _("You must confirm your current password to make changes.")
            )
        return value
