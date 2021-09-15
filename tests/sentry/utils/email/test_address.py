from sentry.testutils import TestCase
from sentry.utils.email.address import get_from_email_domain


class MiscTestCase(TestCase):
    def test_get_from_email_domain(self):
        with self.options({"mail.from": "matt@example.com"}):
            assert get_from_email_domain() == "example.com"

        with self.options({"mail.from": "root@localhost"}):
            assert get_from_email_domain() == "localhost"

        with self.options({"mail.from": "garbage"}):
            assert get_from_email_domain() == "garbage"
