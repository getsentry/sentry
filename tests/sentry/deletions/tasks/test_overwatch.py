import hashlib
import hmac
from typing import Any
from unittest.mock import MagicMock, patch

import responses
from django.test import override_settings

from sentry.deletions.tasks.overwatch import notify_overwatch_organization_deleted
from sentry.testutils.cases import TestCase
from sentry.utils import json


class NotifyOverwatchOrganizationDeletedTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization_id = 12345
        self.organization_slug = "test-org"

        # Mock region
        self.mock_region = MagicMock()
        self.mock_region.name = "us"

    @override_settings(
        OVERWATCH_WEBHOOK_SECRET="test-secret",
        OVERWATCH_REGION_URL="https://overwatch-us.example.com",
    )
    @patch("sentry.deletions.tasks.overwatch.get_local_region")
    @patch("sentry.deletions.tasks.overwatch.logger")
    @patch("sentry.deletions.tasks.overwatch.metrics")
    def test_region_not_enabled(
        self, mock_metrics: Any, mock_logger: Any, mock_get_local_region: Any
    ) -> None:
        mock_get_local_region.return_value = self.mock_region

        with self.options({"overwatch.enabled-regions": []}):
            notify_overwatch_organization_deleted(self.organization_id, self.organization_slug)

        mock_logger.debug.assert_called_once_with(
            "overwatch.organization_deleted.region_not_enabled",
            extra={
                "organization_id": self.organization_id,
                "organization_slug": self.organization_slug,
                "region_name": "us",
            },
        )
        mock_metrics.incr.assert_not_called()

    @override_settings(OVERWATCH_WEBHOOK_SECRET=None)
    @patch("sentry.deletions.tasks.overwatch.get_local_region")
    @patch("sentry.deletions.tasks.overwatch.logger")
    @patch("sentry.deletions.tasks.overwatch.metrics")
    def test_no_webhook_secret(
        self, mock_metrics: Any, mock_logger: Any, mock_get_local_region: Any
    ) -> None:
        mock_get_local_region.return_value = self.mock_region

        with self.options({"overwatch.enabled-regions": ["us"]}):
            notify_overwatch_organization_deleted(self.organization_id, self.organization_slug)

        mock_logger.warning.assert_called_once_with(
            "overwatch.organization_deleted.no_secret",
            extra={
                "organization_id": self.organization_id,
                "organization_slug": self.organization_slug,
            },
        )
        mock_metrics.incr.assert_not_called()

    @override_settings(
        OVERWATCH_WEBHOOK_SECRET="test-secret",
        OVERWATCH_REGION_URL="https://overwatch-us.example.com",
    )
    @responses.activate
    @patch("sentry.deletions.tasks.overwatch.get_local_region")
    @patch("sentry.deletions.tasks.overwatch.logger")
    @patch("sentry.deletions.tasks.overwatch.metrics")
    def test_successful_notification(
        self, mock_metrics: Any, mock_logger: Any, mock_get_local_region: Any
    ) -> None:
        mock_get_local_region.return_value = self.mock_region

        responses.add(
            responses.POST,
            "https://overwatch-us.example.com/webhooks/sentry",
            status=200,
        )

        with self.options({"overwatch.enabled-regions": ["us"]}):
            notify_overwatch_organization_deleted(self.organization_id, self.organization_slug)

        assert len(responses.calls) == 1
        request = responses.calls[0].request

        payload = json.loads(request.body)
        assert payload == {
            "event_type": "organization_delete",
            "organization_id": self.organization_id,
            "organization_slug": self.organization_slug,
            "region": "us",
        }

        expected_signature = hmac.new(
            b"test-secret",
            request.body,
            hashlib.sha256,
        ).hexdigest()
        assert request.headers["x-sentry-overwatch-signature"] == expected_signature
        assert request.headers["content-type"] == "application/json;charset=utf-8"

        mock_logger.info.assert_called_once_with(
            "overwatch.organization_deleted.success",
            extra={
                "organization_id": self.organization_id,
                "organization_slug": self.organization_slug,
                "region_name": "us",
                "status_code": 200,
            },
        )

        mock_metrics.incr.assert_called_once_with(
            "overwatch.organization_deleted.sent",
            amount=1,
            tags={"status": "success", "region": "us"},
        )

    @override_settings(
        OVERWATCH_WEBHOOK_SECRET="test-secret",
        OVERWATCH_REGION_URL=None,  # No URL configured
    )
    @patch("sentry.deletions.tasks.overwatch.get_local_region")
    @patch("sentry.deletions.tasks.overwatch.logger")
    @patch("sentry.deletions.tasks.overwatch.metrics")
    def test_missing_region_url(
        self, mock_metrics: Any, mock_logger: Any, mock_get_local_region: Any
    ) -> None:
        mock_get_local_region.return_value = self.mock_region

        with self.options({"overwatch.enabled-regions": ["us"]}):
            notify_overwatch_organization_deleted(self.organization_id, self.organization_slug)

        mock_logger.warning.assert_called_once_with(
            "overwatch.organization_deleted.missing_region_url",
            extra={
                "organization_id": self.organization_id,
                "organization_slug": self.organization_slug,
                "region_name": "us",
            },
        )

        mock_metrics.incr.assert_called_once_with(
            "overwatch.organization_deleted.sent",
            amount=1,
            tags={"status": "failure", "region": "us"},
        )

    @override_settings(
        OVERWATCH_WEBHOOK_SECRET="test-secret",
        OVERWATCH_REGION_URL="https://overwatch-us.example.com",
    )
    @responses.activate
    @patch("sentry.deletions.tasks.overwatch.get_local_region")
    @patch("sentry.deletions.tasks.overwatch.logger")
    @patch("sentry.deletions.tasks.overwatch.metrics")
    def test_request_failure(
        self, mock_metrics: Any, mock_logger: Any, mock_get_local_region: Any
    ) -> None:
        mock_get_local_region.return_value = self.mock_region

        responses.add(
            responses.POST,
            "https://overwatch-us.example.com/webhooks/sentry",
            status=500,
        )

        with self.options({"overwatch.enabled-regions": ["us"]}):
            notify_overwatch_organization_deleted(self.organization_id, self.organization_slug)

        mock_logger.exception.assert_called_once()
        call_args = mock_logger.exception.call_args
        assert call_args[0][0] == "overwatch.organization_deleted.failed"
        assert call_args[1]["extra"]["organization_id"] == self.organization_id
        assert call_args[1]["extra"]["region_name"] == "us"

        mock_metrics.incr.assert_called_once_with(
            "overwatch.organization_deleted.sent",
            amount=1,
            tags={"status": "failure", "region": "us"},
        )

    @override_settings(
        OVERWATCH_WEBHOOK_SECRET="test-secret",
        OVERWATCH_REGION_URL="https://overwatch-us.example.com",
    )
    @responses.activate
    @patch("sentry.deletions.tasks.overwatch.get_local_region")
    def test_request_timeout(self, mock_get_local_region: Any) -> None:
        import requests

        mock_get_local_region.return_value = self.mock_region

        responses.add(
            responses.POST,
            "https://overwatch-us.example.com/webhooks/sentry",
            body=requests.exceptions.Timeout(),
        )

        with self.options({"overwatch.enabled-regions": ["us"]}):
            notify_overwatch_organization_deleted(self.organization_id, self.organization_slug)

        assert len(responses.calls) == 1

    @override_settings(
        OVERWATCH_WEBHOOK_SECRET="secret-with-special-chars-!@#$%",
        OVERWATCH_REGION_URL="https://overwatch-us.example.com",
    )
    @responses.activate
    @patch("sentry.deletions.tasks.overwatch.get_local_region")
    def test_signature_with_special_characters(self, mock_get_local_region: Any) -> None:
        mock_get_local_region.return_value = self.mock_region

        responses.add(
            responses.POST,
            "https://overwatch-us.example.com/webhooks/sentry",
            status=200,
        )

        with self.options({"overwatch.enabled-regions": ["us"]}):
            notify_overwatch_organization_deleted(self.organization_id, self.organization_slug)

        request = responses.calls[0].request
        payload = request.body

        expected_signature = hmac.new(
            b"secret-with-special-chars-!@#$%",
            payload,
            hashlib.sha256,
        ).hexdigest()
        assert request.headers["x-sentry-overwatch-signature"] == expected_signature

    @override_settings(
        OVERWATCH_WEBHOOK_SECRET="test-secret",
        OVERWATCH_REGION_URL="https://overwatch-us.example.com",
    )
    @patch("sentry.deletions.tasks.overwatch.get_local_region")
    @patch("sentry.deletions.tasks.overwatch.logger")
    @patch("sentry.deletions.tasks.overwatch.metrics")
    def test_get_local_region_error(
        self, mock_metrics: Any, mock_logger: Any, mock_get_local_region: Any
    ) -> None:
        mock_get_local_region.side_effect = Exception("Region not configured")

        with self.options({"overwatch.enabled-regions": ["us"]}):
            notify_overwatch_organization_deleted(self.organization_id, self.organization_slug)

        mock_logger.exception.assert_called_once()
        call_args = mock_logger.exception.call_args
        assert call_args[0][0] == "overwatch.organization_deleted.region_error"
        assert call_args[1]["extra"]["organization_id"] == self.organization_id
        assert call_args[1]["extra"]["error"] == "Region not configured"

        mock_metrics.incr.assert_not_called()

    @override_settings(
        OVERWATCH_WEBHOOK_SECRET="test-secret",
        OVERWATCH_REGION_URL="https://overwatch-us.example.com",
    )
    @responses.activate
    @patch("sentry.deletions.tasks.overwatch.get_local_region")
    @patch("sentry.deletions.tasks.overwatch.logger")
    @patch("sentry.deletions.tasks.overwatch.metrics")
    def test_different_region_name(
        self, mock_metrics: Any, mock_logger: Any, mock_get_local_region: Any
    ) -> None:
        """Test that the correct region name from get_local_region is used"""
        eu_region = MagicMock()
        eu_region.name = "eu"
        mock_get_local_region.return_value = eu_region

        # us is enabled but we're in eu region (not enabled)
        with self.options({"overwatch.enabled-regions": ["us"]}):
            notify_overwatch_organization_deleted(self.organization_id, self.organization_slug)

        # Should log that eu region is not enabled
        mock_logger.debug.assert_called_once_with(
            "overwatch.organization_deleted.region_not_enabled",
            extra={
                "organization_id": self.organization_id,
                "organization_slug": self.organization_slug,
                "region_name": "eu",
            },
        )
        mock_metrics.incr.assert_not_called()
