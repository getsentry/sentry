from datetime import datetime

import pytz
from django import forms
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.utils.safestring import mark_safe
from django.utils.text import capfirst
from django.utils.translation import ugettext_lazy as _

from sentry import newsletter, options
from sentry.app import ratelimiter
from sentry.auth import password_validation
from sentry.models import User
from sentry.utils.auth import find_users, logger
from sentry.web.forms.fields import AllowedEmailField, CustomTypedChoiceField


def _get_timezone_choices():
    results = []
    for tz in pytz.common_timezones:
        now = datetime.now(pytz.timezone(tz))
        offset = now.strftime("%z")
        results.append((int(offset), tz, f"(UTC{offset}) {tz}"))
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
        super().__init__(*args, **kwargs)

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
        return ratelimiter.is_limited(f"auth:ip:{ip_address}", limit)

    def _is_user_rate_limited(self):
        limit = options.get("auth.user-rate-limit")
        if not limit:
            return False

        username = self.cleaned_data.get("username")
        if not username:
            return False

        return ratelimiter.is_limited(f"auth:username:{username}", limit)

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
        coerce=lambda x: str(x) == "1",
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
        super().__init__(*args, **kwargs)
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
        user = super().save(commit=False)
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
        user = super().save(commit=False)
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
        super().__init__(*args, **kwargs)

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


class TwoFactorForm(forms.Form):
    otp = forms.CharField(
        label=_("Authenticator code"),
        max_length=20,
        widget=forms.TextInput(
            attrs={"placeholder": _("Authenticator or recovery code"), "autofocus": True}
        ),
    )
