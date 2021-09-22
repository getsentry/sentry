from sentry.testutils import TestCase
from sentry.utils.email.address import get_from_email_domain, is_valid_email_address


class MiscTestCase(TestCase):
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
