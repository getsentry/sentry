from __future__ import annotations

from sentry_protos.billing.v1.services.usage.v1.endpoint_usage_pb2 import (
    GetUsageRequest,
    GetUsageResponse,
)

from sentry.billing.platform.core import BillingService, service_method
from sentry.billing.platform.services.usage._outcomes_query import query_outcomes_usage


class UsageService(BillingService):
    @service_method
    def get_usage(self, request: GetUsageRequest) -> GetUsageResponse:
        """
        Get daily usage data for an organization within a date range.

        Returns usage broken down by day, with per-category totals for
        accepted, dropped, filtered, over_quota, spike_protection, and
        dynamic_sampling.
        """
        return query_outcomes_usage(request)
