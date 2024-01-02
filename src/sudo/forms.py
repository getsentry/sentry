"""
sudo.forms
~~~~~~~~~~

:copyright: (c) 2020 by Matt Robenolt.
:license: BSD, see LICENSE for more details.
"""
from __future__ import annotations

from typing import Any

from django import forms
from django.contrib import auth
from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.models import AnonymousUser
from django.utils.translation import gettext_lazy as _


class SudoForm(forms.Form):
    """
    A simple password input form used by the default :func:`~sudo.views.sudo` view.
    """

    password = forms.CharField(label=_("Password"), widget=forms.PasswordInput)

    def __init__(self, user: AnonymousUser | AbstractBaseUser, *args: Any, **kwargs: Any) -> None:
        self.user = user
        super().__init__(*args, **kwargs)

    def clean_password(self) -> str:
        username = self.user.get_username()

        if auth.authenticate(
            request=None,
            username=username,
            password=self.data["password"],
        ):
            return self.data["password"]

        raise forms.ValidationError(_("Incorrect password"))
