from __future__ import absolute_import

from sentry.security.utils import is_valid_email_address


def test_is_valid_email_address_number_at_qqcom():
    assert is_valid_email_address("12345@qq.com") is False


def test_is_valid_email_address_normal_human_email_address():
    assert is_valid_email_address("dcramer@gmail.com") is True
