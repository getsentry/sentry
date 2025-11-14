from typing import int
import pytest
from django.core.signing import BadSignature

from sentry import options
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.email.address import (
    email_to_group_id,
    get_from_email_domain,
    group_id_to_email,
    is_valid_email_address,
    parse_email,
    parse_user_name,
)


@django_db_all
def test_get_from_email_domain() -> None:
    with override_options({"mail.from": "matt@example.com"}):
        assert get_from_email_domain() == "example.com"

    with override_options({"mail.from": "root@localhost"}):
        assert get_from_email_domain() == "localhost"

    with override_options({"mail.from": "garbage"}):
        assert get_from_email_domain() == "garbage"


def test_is_valid_email_address_number_at_qqcom() -> None:
    assert is_valid_email_address("12345@qq.com") is False


def test_is_valid_email_address_normal_human_email_address() -> None:
    assert is_valid_email_address("dcramer@gmail.com") is True


def test_parse_email_empty() -> None:
    assert parse_email("") == ""


def test_parse_email_no_email() -> None:
    assert parse_email("marcos@sentry.io") == ""


def test_parse_email_empty_email() -> None:
    assert parse_email("<>") == ""


def test_parse_email_two_emails() -> None:
    assert parse_email("<a><b>") == "a"


def test_parse_email_simple() -> None:
    assert parse_email("lauryn <lauryn@sentry.io>") == "lauryn@sentry.io"


def test_parse_user_name_empty() -> None:
    assert parse_user_name("") == ""


def test_parse_user_name_no_email() -> None:
    assert parse_user_name("marcos@sentry.io") == "marcos@sentry.io"


def test_parse_user_name_empty_email() -> None:
    assert parse_user_name("<>") == ""


def test_parse_user_name_simple() -> None:
    assert parse_user_name("Max Bittker <max@getsentry.com>") == "Max Bittker"


@django_db_all
def test_group_id_to_email_backwards_compat() -> None:
    mailhost = options.get("mail.reply-hostname")
    group_id = 1234567

    signed = group_id_to_email(group_id)
    assert f"@{mailhost}" in signed
    assert f"{group_id}+" in signed

    result_group_id, org_id = email_to_group_id(signed)
    assert result_group_id == group_id
    assert org_id is None


@django_db_all
def test_group_id_to_email_with_org_id() -> None:
    mailhost = options.get("mail.reply-hostname")
    group_id = 1234567
    org_id = 9876543

    signed = group_id_to_email(group_id, org_id)
    assert f"@{mailhost}" in signed
    assert f"{group_id}.{org_id}+" in signed

    result_group_id, result_org_id = email_to_group_id(signed)
    assert result_group_id == group_id
    assert result_org_id == org_id

    with pytest.raises(BadSignature):
        assert email_to_group_id(f"trash@{mailhost}") == (None, None)

    with pytest.raises(BadSignature):
        assert email_to_group_id(f"trash:rubbish@{mailhost}") == (None, None)
