from unittest.mock import MagicMock, patch

import pytest

from sentry.sentry_apps.external_requests.utils import send_and_save_sentry_app_request
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer


@cell_silo_test
class SendAndSaveSentryAppRequestInvalidHeaderTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        # Ideographic space U+3000 is not latin-1 encodable (SENTRY-5TWJ).
        bad_header = "Authorization: Bearer　token"
        self.sentry_app = self.create_sentry_app(
            name="HeaderApp",
            organization=self.organization,
            webhook_url="https://example.com/webhook",
            published=True,
            webhook_headers=[bad_header],
        )

    @patch("sentry.sentry_apps.external_requests.utils.safe_urlopen")
    def test_non_latin1_header_raises_integrator_error(self, mock_safe_urlopen: MagicMock) -> None:
        mock_safe_urlopen.side_effect = UnicodeEncodeError(
            "latin-1", "Bearer　token", 6, 7, "ordinal not in range(256)"
        )

        with pytest.raises(SentryAppIntegratorError) as exc_info:
            send_and_save_sentry_app_request(
                url="https://example.com/webhook",
                sentry_app=self.sentry_app,
                org_id=self.organization.id,
                event="select_options.requested",
                headers={"Content-Type": "application/json"},
            )

        assert "non-latin-1" in exc_info.value.message
        assert exc_info.value.status_code == 400
        # Exception message must not include the raw header/token.
        assert "Bearer" not in repr(exc_info.value)

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()
        assert len(requests) == 1
        assert requests[0]["response_code"] == 0
