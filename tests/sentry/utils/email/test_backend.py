from sentry.testutils.cases import TestCase
from sentry.utils.email.backend import get_mail_backend


class GetMailBackendTest(TestCase):
    def test_get_mail_backend(self):
        with self.options({"mail.backend": "smtp"}):
            assert get_mail_backend() == "django.core.mail.backends.smtp.EmailBackend"

        with self.options({"mail.backend": "dummy"}):
            assert get_mail_backend() == "django.core.mail.backends.dummy.EmailBackend"

        with self.options({"mail.backend": "console"}):
            assert get_mail_backend() == "django.core.mail.backends.console.EmailBackend"

        with self.options({"mail.backend": "something.else"}):
            assert get_mail_backend() == "something.else"
