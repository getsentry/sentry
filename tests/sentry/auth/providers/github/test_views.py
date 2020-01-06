from __future__ import absolute_import

import pytest

from sentry.auth.providers.github.views import _get_name_from_email

expected_data = [
    ("john.smith@example.com", "John Smith"),
    ("john@example.com", "John"),
    ("XYZ-234=3523@example.com", "Xyz-234=3523"),
    ("XYZ.1111@example.com", "Xyz 1111"),
    ("JOHN@example.com", "John"),
]


@pytest.mark.parametrize("email,expected_name", expected_data)
def test_get_name_from_email(email, expected_name):
    assert _get_name_from_email(email) == expected_name
