from django.core.exceptions import ValidationError
from django.test import override_settings
from pytest import raises

from sentry.auth.password_validation import validate_password
from sentry.conf.server import AUTH_PASSWORD_VALIDATORS
from sentry.models.user import User
from sentry.testutils.cases import TestCase


@override_settings(AUTH_PASSWORD_VALIDATORS=AUTH_PASSWORD_VALIDATORS)
class PasswordValidationTestCase(TestCase):
    def test_user_attribute_similarity(self):
        user = User(username="hello@example.com")
        with raises(ValidationError, match="The password is too similar to the username."):
            validate_password("hallo@example.com", user=user)

    def test_minimum_length(self):
        with raises(ValidationError, match="This password is too short."):
            validate_password("p@sswrd")

    def test_maximum_length(self):
        with raises(ValidationError, match="This password is too long."):
            validate_password("A" * 257)

    def test_common_password(self):
        with raises(ValidationError, match="This password is too common."):
            validate_password("password")

    def test_numeric_password(self):
        with raises(ValidationError, match="This password is entirely numeric."):
            validate_password("12345670007654321")
