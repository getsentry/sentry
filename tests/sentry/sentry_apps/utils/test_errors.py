from typing import int
from sentry.sentry_apps.utils.errors import SentryAppError, SentryAppIntegratorError
from sentry.testutils.cases import TestCase


class TestSentryAppBaseError(TestCase):

    def test_to_public_dict(self) -> None:
        error = SentryAppError(message="brooo", public_context={"omg": "omgggg"})
        body = error.to_public_dict()

        assert body == {"detail": "brooo", "context": {"omg": "omgggg"}}

    def test_to_public_dict_no_webhook_context(self) -> None:
        error = SentryAppIntegratorError(
            message="brooo", public_context={"omg": "omgggg"}, webhook_context={"bruh": "bruhh"}
        )
        body = error.to_public_dict()

        assert body == {"detail": "brooo", "context": {"omg": "omgggg"}}

    def test_to_public_dict_no_context(self) -> None:
        error = SentryAppIntegratorError(message="brooo")
        body = error.to_public_dict()

        assert body == {"detail": "brooo"}
