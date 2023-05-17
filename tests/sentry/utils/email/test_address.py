from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.email.address import (
    get_from_email_domain,
    is_valid_email_address,
    parse_email,
    parse_user_name,
)


class GetFromEmailDomainTest(TestCase):
    def test_get_from_email_domain(self):
        with self.options({"mail.from": "matt@example.com"}):
            assert get_from_email_domain() == "example.com"

        with self.options({"mail.from": "root@localhost"}):
            assert get_from_email_domain() == "localhost"

        with self.options({"mail.from": "garbage"}):
            assert get_from_email_domain() == "garbage"


class ValidEmailTest(TestCase):
    def test_is_valid_email_address_number_at_qqcom(self):
        assert is_valid_email_address("12345@qq.com") is False

    def test_is_valid_email_address_normal_human_email_address(self):
        assert is_valid_email_address("dcramer@gmail.com") is True


class ParseEmailTest(TestCase):
    def test_empty(self):
        assert parse_email("") == ""

    def test_no_email(self):
        assert parse_email("marcos@sentry.io") == ""

    def test_empty_email(self):
        assert parse_email("<>") == ""

    def test_two_emails(self):
        assert parse_email("<a><b>") == "a"

    def test_simple(self):
        assert parse_email("lauryn <lauryn@sentry.io>") == "lauryn@sentry.io"


@control_silo_test(stable=True)
class ParseUserNameTest(TestCase):
    def test_empty(self):
        assert parse_user_name("") == ""

    def test_no_email(self):
        assert parse_user_name("marcos@sentry.io") == "marcos@sentry.io"

    def test_empty_email(self):
        assert parse_user_name("<>") == ""

    def test_simple(self):
        assert parse_user_name("Max Bittker <max@getsentry.com>") == "Max Bittker"
