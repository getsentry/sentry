import pytest
from django import forms

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.web.accounts_form import RelocationForm


@control_silo_test
class TestRelocationForm(TestCase):
    def test_placeholder_username(self) -> None:
        username = "test_user"
        user = self.create_user(username=username)
        relocation_form = RelocationForm(user=user)

        assert relocation_form.fields["username"].widget.attrs["placeholder"] == username

    def test_clean_username_use_default_username_if_none_entered(self) -> None:
        username = "test_user"
        user = self.create_user(username=username)
        relocation_form = RelocationForm(user=user)
        relocation_form.cleaned_data = {"username": ""}

        assert relocation_form.clean_username() == username

    def test_clean_username_strips_special_chars(self) -> None:
        username = "test_user"
        user = self.create_user(username=username)
        relocation_form = RelocationForm(user=user)
        relocation_form.cleaned_data = {"username": "\n\rnew_u\n\n \0se\r\trname\n\n\t\r\0\n"}

        assert relocation_form.clean_username() == "new_username"

    def test_clean_username_forces_lowercase(self) -> None:
        username = "test_user"
        user = self.create_user(username=username)
        relocation_form = RelocationForm(user=user)
        relocation_form.cleaned_data = {"username": "nEw_UsErname"}

        assert relocation_form.clean_username() == "new_username"

    def test_clean_username_rejects_existing_username(self) -> None:
        self.create_user(username="taken_username")
        user = self.create_user(username="test_user")
        relocation_form = RelocationForm(user=user)
        relocation_form.cleaned_data = {"username": "taken_username"}

        with pytest.raises(forms.ValidationError):
            relocation_form.clean_username()

    def test_clean_username_rejects_another_users_email(self) -> None:
        self.create_user(email="mail@example.com", username="sso-abc123")
        user = self.create_user(username="test_user")
        relocation_form = RelocationForm(user=user)
        relocation_form.cleaned_data = {"username": "mail@example.com"}

        with pytest.raises(forms.ValidationError):
            relocation_form.clean_username()

    def test_clean_password(self) -> None:
        username = "test_user"
        user = self.create_user(username=username)
        relocation_form = RelocationForm(user=user)
        relocation_form.cleaned_data = {"password": "new_password"}

        assert relocation_form.clean_password() == "new_password"
