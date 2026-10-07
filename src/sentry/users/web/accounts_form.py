from __future__ import annotations

import re
from typing import Any

from django import forms
from django.conf import settings
from django.utils.translation import gettext_lazy as _

from sentry.auth import password_validation
from sentry.users.models.user import User
from sentry.utils.dates import get_timezone_choices
from sentry.web.forms.fields import AllowedEmailField

TIMEZONE_CHOICES = get_timezone_choices()


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

    def __init__(self, user: User, *args: Any, **kwargs: Any) -> None:
        self.user = user
        super().__init__(*args, **kwargs)

        needs_password = user.has_usable_password()

        if not needs_password:
            del self.fields["password"]

    def clean_password(self) -> str:
        value = self.cleaned_data.get("password")
        if value and not self.user.check_password(value):
            raise forms.ValidationError(_("The password you entered is not correct."))
        elif not value:
            raise forms.ValidationError(
                _("You must confirm your current password to make changes.")
            )
        return value


class RelocationForm(forms.Form):
    username = forms.CharField(max_length=128, required=False, widget=forms.TextInput())
    password = forms.CharField(widget=forms.PasswordInput())
    tos_check = forms.BooleanField(
        label=_(
            f"I agree to the <a href={settings.TERMS_URL}>Terms of Service</a> and <a href={settings.PRIVACY_URL}>Privacy Policy</a>"
        ),
        widget=forms.CheckboxInput(),
        required=False,
        initial=False,
    )

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)
        self.fields["username"].widget.attrs.update(placeholder=self.user.username)

    def clean_username(self) -> str | None:
        value = self.cleaned_data.get("username") or self.user.username
        value = re.sub(r"[ \n\t\r\0]*", "", value)
        if not value:
            return None
        if not User.is_username_available(value, exclude_user_id=self.user.id):
            raise forms.ValidationError(_("An account is already registered with that username."))
        return value.lower()

    def clean_password(self) -> str:
        password = self.cleaned_data["password"]
        password_validation.validate_password(password, user=self.user)
        return password

    def clean_tos_check(self) -> None:
        value = self.cleaned_data.get("tos_check")
        if not value:
            raise forms.ValidationError(
                _("You must agree to the Terms of Service and Privacy Policy before proceeding.")
            )
        return None
