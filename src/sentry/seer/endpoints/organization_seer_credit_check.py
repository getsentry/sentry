from __future__ import annotations

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.billing.v1.services.seer_feature_billing.v1.endpoint_check_seer_credits_pb2 import (
    CheckSeerCreditsResponse,
)

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.credits import SeerFeature, SeerOperation, check_seer_operation
from sentry.types.ratelimit import RateLimit, RateLimitCategory

# Unspecified and unknown reasons map to None, so a reason added to the proto
# before this mapping doesn't leak an enum name into the API.
_DENIAL_REASONS: dict[CheckSeerCreditsResponse.DenialReason.ValueType, str] = {
    CheckSeerCreditsResponse.DENIAL_REASON_NOT_ENOUGH_CREDITS: "not_enough_credits",
    CheckSeerCreditsResponse.DENIAL_REASON_DAILY_CAP_EXCEEDED: "daily_cap_exceeded",
}


class SeerCreditCheckSerializer(serializers.Serializer[dict[str, str]]):
    operation = serializers.ChoiceField(choices=[operation.value for operation in SeerOperation])


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
        # TODO: Let the UI pass the feature once it can tell agentic triage runs apart.
        feature = (
            SeerFeature.EXPLORER
            if operation == SeerOperation.AGENT_CHAT_MESSAGE
            else SeerFeature.AUTOFIX
        )
        credits = check_seer_operation(organization, feature, operation)
        return Response(
            {
                "hasEnoughCredits": credits.has_enough_credits,
                "denialReason": _DENIAL_REASONS.get(credits.denial_reason),
            }
        )
