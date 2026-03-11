"""
API endpoint for generating assertion suggestions using Seer.

This endpoint runs a preview check and uses Seer to analyze the response
and suggest assertions that would be useful for monitoring the endpoint.
"""

import logging

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationAlertRulePermission, OrganizationEndpoint
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_SUCCESS,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.seer_setup import has_seer_access
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.uptime import checker_api
from sentry.uptime.endpoints.validators import UptimeCheckPreviewValidator
from sentry.uptime.seer_assertions import (
    generate_assertion_suggestions,
    suggestion_to_assertion_json,
    suggestions_to_combined_assertion,
)
from sentry.uptime.subscriptions.regions import get_region_config
from sentry.uptime.types import CheckConfig

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationUptimeAssertionSuggestionsEndpoint(OrganizationEndpoint):
    """
    Endpoint to generate assertion suggestions for an uptime monitor.

    This runs a preview check against the specified URL and uses Seer AI
    to analyze the response and suggest useful assertions.
    """

    owner = ApiOwner.CRONS
    permission_classes = (OrganizationAlertRulePermission,)

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }

    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                # More restrictive rate limits since this calls Seer
                RateLimitCategory.USER: RateLimit(limit=1, window=5, concurrent_limit=2),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=10, window=60, concurrent_limit=5),
            },
        }
    )

    @extend_schema(
        operation_id="Generate assertion suggestions for an uptime monitor",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        responses={
            200: RESPONSE_SUCCESS,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self,
        request: Request,
        organization: Organization,
    ) -> Response:
        # Check if AI features are enabled (includes gen-ai-features flag + hide_ai_features opt-out)
        if not has_seer_access(organization, actor=request.user):
            return self.respond(
                {"detail": "AI features are not enabled for this organization"},
                status=403,
            )

        # Check if assertions are enabled
        assertions_enabled = features.has(
            "organizations:uptime-runtime-assertions", organization, actor=request.user
        )
        if not assertions_enabled:
            return self.respond(
                {"detail": "Uptime assertions are not enabled for this organization"},
                status=403,
            )

        # Validate the request
        validator = UptimeCheckPreviewValidator(
            data=request.data, context={"organization": organization, "request": request}
        )
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        check_config: CheckConfig = validator.save()

        # We made it through validation, so active_regions is non-empty
        region = get_region_config(check_config["active_regions"][0])
        if region is None:
            return self.respond({"detail": "No uptime region configured"}, status=400)

        # Run the preview check
        result = checker_api.invoke_checker_preview(assertions_enabled, check_config, region)

        if result is None:
            return self.respond(
                {"detail": "Failed to execute preview check"},
                status=400,
            )

        if result.status_code >= 400 and result.status_code < 500:
            return self.respond(result.json(), status=result.status_code)

        result.raise_for_status()
        preview_result = result.json()

        # Generate suggestions using Seer
        try:
            suggestions, debug_info = generate_assertion_suggestions(preview_result)
            if debug_info:
                logger.error("Seer suggestion generation issue: %s", debug_info)
        except Exception:
            logger.exception("Error generating assertion suggestions")
            suggestions = None

        # Build response
        response_data = {
            "preview_result": preview_result,
            "suggestions": None,
            "suggested_assertion": None,
        }

        if suggestions and suggestions.suggestions:
            response_data["suggestions"] = [
                {
                    "assertion_type": s.assertion_type,
                    "comparison": s.comparison,
                    "expected_value": s.expected_value,
                    "json_path": s.json_path,
                    "header_name": s.header_name,
                    "confidence": s.confidence,
                    "explanation": s.explanation,
                    "assertion_json": suggestion_to_assertion_json(s),
                }
                for s in suggestions.suggestions
            ]
            # Also provide a combined assertion that includes all suggestions
            response_data["suggested_assertion"] = suggestions_to_combined_assertion(
                suggestions.suggestions
            )

        return self.respond(response_data)
