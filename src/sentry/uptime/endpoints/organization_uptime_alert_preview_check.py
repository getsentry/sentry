import logging

import requests
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
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
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.uptime.endpoints.validators import UptimeCheckPreviewValidator
from sentry.uptime.subscriptions.regions import get_region_config
from sentry.uptime.types import CheckConfig

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationUptimeAlertPreviewCheckEndpoint(OrganizationEndpoint):
    owner = ApiOwner.CRONS

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }

    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.USER: RateLimit(limit=1, window=1, concurrent_limit=5),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=40, window=1, concurrent_limit=5),
            },
        }
    )

    @extend_schema(
        operation_id="Execute an Uptime Alert Rule for a supplied CheckConfig",
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
        assertions_enabled = features.has(
            "organizations:uptime-runtime-assertions", organization, actor=request.user
        )
        validator = UptimeCheckPreviewValidator(assertions_enabled, data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        check_config: CheckConfig = validator.save()

        # We made it through validation, so this region is non-null
        region = get_region_config(check_config["active_regions"][0])
        assert region is not None

        api_endpoint = region.api_endpoint

        result = requests.post(
            f"http://{api_endpoint}/execute_config",
            json=check_config,
            timeout=10,
        )

        # Make sure we propagate the error json in the case of a 400 error
        if result.status_code >= 400 and result.status_code < 500:
            return self.respond(result.json(), status=result.status_code)

        result.raise_for_status()
        return self.respond(result.json())
