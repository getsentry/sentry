from typing import int
from django.test.utils import override_settings
from django.urls import reverse

from sentry.conf.types.sentry_config import SentryMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test


@all_silo_test
class TestSecurityTxt(TestCase):
    def test_simple(self) -> None:
        with override_settings(SENTRY_MODE=SentryMode.SAAS):
            response = self.client.get(reverse("sentry-security-txt"))
            assert response.status_code == 200
            assert b"Contact: security@sentry.io" in response.content
            assert response["Content-Type"] == "text/plain"

    def test_self_hosted_not_found(self) -> None:
        with override_settings(SENTRY_MODE=SentryMode.SELF_HOSTED):
            response = self.client.get(reverse("sentry-security-txt"))
            assert response.status_code == 404
