"""
Customer Billing History API Endpoint

Provides billing history data for customers/organizations with graceful handling
of historical tier configurations that may no longer exist in current plan definitions.

Fixes SENTRY-3B06: Historical billing data contains reserved quantities for tiers
that have been modified or removed from plan definitions over time.
"""
from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.billing_history import BillingHistorySerializer


@region_silo_endpoint
class CustomerHistoryEndpoint(OrganizationEndpoint):
    """
    Retrieve billing history for a customer/organization.

    Returns historical billing periods with metrics, usage, and spend data.
    Handles legacy tier configurations gracefully to prevent TierNotFound errors.
    """

    owner = ApiOwner.BILLING
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization) -> Response:
        """
        Get billing history for an organization.

        Returns a list of billing periods with:
        - Reserved quantities (may reference historical tiers)
        - Usage data
        - On-demand spend
        - Plan details

        Historical data may contain tier references that no longer exist in current
        plan definitions. The serializer handles this gracefully without raising errors.
        """
        # This is a placeholder implementation
        # In a real implementation, this would:
        # 1. Query the billing database for historical records
        # 2. Load plan details for each period
        # 3. Serialize the data using BillingHistorySerializer
        #
        # The key fix for SENTRY-3B06 is in the serializer which doesn't
        # validate historical quantities against current plan tiers

        # Mock response for demonstration
        # In production, this would come from database queries
        history_records = self._get_billing_history(organization)

        return Response(
            serialize(history_records, request.user, BillingHistorySerializer(), many=True)
        )

    def _get_billing_history(self, organization):
        """
        Retrieve billing history records for an organization.

        This is a placeholder that would be replaced with actual database queries
        in a production implementation.
        """
        # TODO: Implement actual database queries
        # This would typically:
        # 1. Query BillingMetricHistory table
        # 2. Join with plan/subscription data
        # 3. Return list of billing periods
        return []


@region_silo_endpoint  
class CustomerHistoryDetailEndpoint(OrganizationEndpoint):
    """
    Retrieve a specific billing history record.

    Returns detailed billing information for a single billing period.
    """

    owner = ApiOwner.BILLING
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization, history_id) -> Response:
        """
        Get a specific billing history record.

        Args:
            history_id: The ID of the billing history record to retrieve
        """
        # This is a placeholder implementation
        # In production, this would query for a specific history record
        
        history_record = self._get_billing_history_by_id(organization, history_id)

        if history_record is None:
            return Response({"detail": "Billing history record not found"}, status=404)

        return Response(serialize(history_record, request.user, BillingHistorySerializer()))

    def _get_billing_history_by_id(self, organization, history_id):
        """
        Retrieve a specific billing history record.

        This is a placeholder that would be replaced with actual database queries.
        """
        # TODO: Implement actual database query
        return None


@region_silo_endpoint
class CustomerHistoryCurrentEndpoint(OrganizationEndpoint):
    """
    Retrieve the current billing period for a customer/organization.

    Returns the active billing period with current usage and spend data.
    """

    owner = ApiOwner.BILLING
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization) -> Response:
        """
        Get the current billing period for an organization.

        Returns the active billing period marked with isCurrent=true.
        """
        # This is a placeholder implementation
        current_history = self._get_current_billing_history(organization)

        if current_history is None:
            return Response({"detail": "No current billing period found"}, status=404)

        return Response(serialize(current_history, request.user, BillingHistorySerializer()))

    def _get_current_billing_history(self, organization):
        """
        Retrieve the current billing period.

        This is a placeholder that would be replaced with actual database queries.
        """
        # TODO: Implement actual database query
        # This would query for the billing period where:
        # - period_start <= now < period_end
        # - is_current = True
        return None
