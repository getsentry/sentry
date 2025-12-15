import logging

import requests
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.conf.server import UPTIME_REGIONS
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimit, RateLimitCategory, RateLimitConfig
from sentry.uptime.endpoints.serializers import UptimeDetectorSerializer
from sentry.uptime.endpoints.validators import UptimeTestValidator
from sentry.uptime.types import CheckConfig

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationUptimeAlertTestEndpoint(OrganizationEndpoint):
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
            200: UptimeDetectorSerializer,
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
        validator = UptimeTestValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        check: CheckConfig = validator.save()

        region = [r for r in UPTIME_REGIONS if r.slug == check["active_regions"][0]]

        if len(region) == 0:
            return self.respond("No such region", status=400)

        api_endpoint = region[0].api_endpoint

        try:
            result = requests.post(
                f"http://{api_endpoint}/execute_config",
                headers={
                    "content-type": "application/json;charset=utf-8",
                },
                json=check,
                timeout=10,
            )
            result.raise_for_status()
            return self.respond(result.json())
        except requests.RequestException as e:
            logger.exception(
                "uptime.test_endpoint",
                extra={
                    "organization_id": organization.id,
                    "error": str(e),
                },
            )
            return self.respond(status=500)
