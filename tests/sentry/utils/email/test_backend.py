import pytest
from django.test import override_settings

from sentry.testutils.cases import TestCase
from sentry.utils.email.backend import get_mail_backend


class GetMailBackendTest(TestCase):
    def test_get_mail_backend(self) -> None:
        with self.options({"mail.backend": "smtp"}):
            assert get_mail_backend() == "django.core.mail.backends.smtp.EmailBackend"

        with self.options({"mail.backend": "dummy"}):
            assert get_mail_backend() == "django.core.mail.backends.dummy.EmailBackend"

        with self.options({"mail.backend": "something.else"}):
            assert get_mail_backend() == "something.else"

    @override_settings(DEBUG=True)
    def test_console_backend_in_debug_mode(self) -> None:
        with self.options({"mail.backend": "console"}):
            assert get_mail_backend() == "django.core.mail.backends.console.EmailBackend"

    @override_settings(DEBUG=False)
    def test_console_backend_outside_debug_mode(self) -> None:
        with self.options({"mail.backend": "console"}):
            with pytest.raises(
                RuntimeError, match="Console email backend is only available in debug mode"
            ):
                get_mail_backend()
