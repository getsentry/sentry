from __future__ import annotations

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.billing.v1.common.v1.seer_billing_feature_pb2 import (
    SEER_BILLING_FEATURE_AUTOFIX_WEB,
    SEER_BILLING_FEATURE_SEER_AGENT,
    SEER_BILLING_FEATURE_UNSPECIFIED,
    SeerBillingFeature,
)

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.credits import SeerOperation, can_run_seer_operation
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class SeerCreditCheckSerializer(serializers.Serializer[dict[str, str]]):
    operation = serializers.ChoiceField(choices=[operation.value for operation in SeerOperation])
    billing_feature = serializers.ChoiceField(
        choices=[
            value
            for value in SeerBillingFeature.values()
            if value != SEER_BILLING_FEATURE_UNSPECIFIED
        ],
        required=False,
    )


@cell_silo_endpoint
class OrganizationSeerCreditCheckEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=200, window=60, concurrent_limit=20),
                RateLimitCategory.USER: RateLimit(limit=100, window=60, concurrent_limit=10),
                RateLimitCategory.ORGANIZATION: RateLimit(
                    limit=1000, window=60, concurrent_limit=100
                ),
            }
        }
    )

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Checks whether the organization has enough Seer credits to run the operation.
        """
        serializer = SeerCreditCheckSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        operation = SeerOperation(serializer.validated_data["operation"])

        if "billing_feature" in serializer.validated_data:
            feature = serializer.validated_data["billing_feature"]
        elif operation == SeerOperation.AGENT_CHAT_MESSAGE:
            feature = SEER_BILLING_FEATURE_SEER_AGENT
        else:
            feature = SEER_BILLING_FEATURE_AUTOFIX_WEB

        return Response(
            {"hasEnoughCredits": can_run_seer_operation(organization, feature, operation)}
        )
