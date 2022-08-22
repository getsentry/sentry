import pytest
from django.forms import ValidationError
from django.test import override_settings

from fixtures.sudo_testutils import BaseTestCase, EmailUser
from sudo.forms import SudoForm


@override_settings(
    AUTHENTICATION_BACKENDS=[
        "fixtures.sudo_testutils.FooPasswordBackend",
        "fixtures.sudo_testutils.StubPasswordBackend",
    ]
)
class SudoFormTestCase(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.login()

    def test_integration_empty(self):
        self.assertFalse(SudoForm(self.user).is_valid())

    def test_integration_invalid_password(self):
        self.assertFalse(SudoForm(self.user, {"password": "lol"}).is_valid())

    def test_integration_valid_password(self):
        self.assertTrue(SudoForm(self.user, {"password": "foo"}).is_valid())

    def test_integration_secondary_auth_valid_password(self):
        self.assertTrue(SudoForm(self.user, {"password": "stub"}).is_valid())

    def test_clean_password_invalid_password(self):
        with pytest.raises(ValidationError):
            SudoForm(self.user, {"password": "lol"}).clean_password()

    def test_clean_password_valid_password(self):
        password = "foo"
        self.assertEqual(SudoForm(self.user, {"password": password}).clean_password(), password)

    def test_clean_password_secondary_auth_valid_password(self):
        password = "stub"
        self.assertEqual(SudoForm(self.user, {"password": password}).clean_password(), password)

    def test_integration_custom_user(self):
        self.login(EmailUser)
        self.assertTrue(SudoForm(self.user, {"password": "foo"}).is_valid())
