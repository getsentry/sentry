from __future__ import annotations

from datetime import datetime, timezone
from unittest import mock

import pytest
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.billing.v1.services.usage.v1.endpoint_usage_pb2 import (
    GetUsageRequest,
    GetUsageResponse,
)

from sentry.billing.platform.core import BillingService
from sentry.billing.platform.services.usage import UsageService
from sentry.billing.platform.services.usage.service import (
    UsageService as UsageServiceDirect,
)


class TestUsageService:
    """Tests for the UsageService."""

    def test_inherits_from_billing_service(self):
        service = UsageService()
        assert isinstance(service, BillingService)

    def test_get_usage_returns_empty_response(self):
        service = UsageService()
        request = GetUsageRequest()
        response = service.get_usage(request)

        assert isinstance(response, GetUsageResponse)
        assert list(response.days) == []
        assert list(response.seats) == []

    def test_get_usage_with_populated_request(self):
        service = UsageService()

        start = Timestamp()
        start.FromDatetime(datetime(2026, 1, 1, tzinfo=timezone.utc))
        end = Timestamp()
        end.FromDatetime(datetime(2026, 1, 31, tzinfo=timezone.utc))

        request = GetUsageRequest(organization_id=1, start=start, end=end)
        response = service.get_usage(request)

        assert isinstance(response, GetUsageResponse)
        assert list(response.days) == []
        assert list(response.seats) == []

    def test_get_usage_rejects_non_protobuf_input(self):
        service = UsageService()

        with pytest.raises(TypeError, match="expects a protobuf Message"):
            service.get_usage("not a protobuf")  # type: ignore[arg-type]

    @mock.patch("sentry.billing.platform.core.service.metrics")
    def test_get_usage_emits_metrics(self, mock_metrics):
        service = UsageService()
        request = GetUsageRequest(organization_id=1)
        service.get_usage(request)

        mock_metrics.incr.assert_any_call(
            "billing.service.method.called",
            tags={"service": "UsageService", "method": "get_usage"},
        )
        mock_metrics.incr.assert_any_call(
            "billing.service.method.success",
            tags={"service": "UsageService", "method": "get_usage"},
        )
        mock_metrics.timing.assert_called()

    def test_package_reexport(self):
        assert UsageService is UsageServiceDirect
