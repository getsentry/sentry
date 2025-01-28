from typing import Any

import responses
from django.core.exceptions import ValidationError
from django.test import override_settings
from pytest import raises

from sentry.auth.password_validation import validate_password
from sentry.conf.server import AUTH_PASSWORD_VALIDATORS
from sentry.testutils.cases import TestCase
from sentry.users.models.user import User

PWNED_PASSWORDS_RESPONSE_MOCK = """4145D488EF49819E75E71019A6E8EA21905:1
4186AA7593257C23D6A76D99FBEB3D3FEAF:2
41A2E3C98F52EFA27C4E7E3B5E47D39AB0D:34
41AAFED3906C438EFA48AF1F30B8420D29A:5
41B1F73A901ACAE8DC9BBB439A6E14903C6:3
"""

AUTH_PASSWORD_VALIDATORS_TEST: list[dict[str, Any]] = [
    v
    for v in AUTH_PASSWORD_VALIDATORS
    if v["NAME"] != "sentry.auth.password_validation.PwnedPasswordsValidator"
]


@override_settings(AUTH_PASSWORD_VALIDATORS=AUTH_PASSWORD_VALIDATORS_TEST)
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

    @responses.activate
    @override_settings(
        AUTH_PASSWORD_VALIDATORS=[
            {
                "NAME": "sentry.auth.password_validation.PwnedPasswordsValidator",
                "OPTIONS": {"threshold": 34},
            }
        ]
    )
    def test_pwned_passwords(self):
        # sha1("hiphophouse") == "74BA3..."
        responses.add(
            responses.GET,
            "https://api.pwnedpasswords.com/range/74BA3",
            body=PWNED_PASSWORDS_RESPONSE_MOCK,
        )
        with raises(
            ValidationError,
            match="This password has previously appeared in data breaches 34 times.",
        ):
            validate_password("hiphophouse")

    @responses.activate
    @override_settings(
        AUTH_PASSWORD_VALIDATORS=[
            {
                "NAME": "sentry.auth.password_validation.PwnedPasswordsValidator",
                "OPTIONS": {"threshold": 35},
            }
        ]
    )
    def test_pwned_passwords_low_threshold(self):
        responses.add(
            responses.GET,
            "https://api.pwnedpasswords.com/range/74BA3",
            body=PWNED_PASSWORDS_RESPONSE_MOCK,
        )
        validate_password("hiphophouse")  # should not raise

    @responses.activate
    @override_settings(
        AUTH_PASSWORD_VALIDATORS=[
            {"NAME": "sentry.auth.password_validation.PwnedPasswordsValidator"}
        ]
    )
    def test_pwned_passwords_corrupted_content(self):
        responses.add(
            responses.GET,
            "https://api.pwnedpasswords.com/range/74BA3",
            body="corrupted_content_with_no_colon",
        )
        validate_password("hiphophouse")  # should not raise
