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
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.uptime.endpoints.serializers import UptimeDetectorSerializer
from sentry.uptime.endpoints.validators import UptimeTestValidator
from sentry.uptime.types import CheckConfig

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationUptimeAlertValidateCheckEndpoint(OrganizationEndpoint):
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
        operation_id="Validate and compile an Uptime Alert Rule for a supplied CheckConfig",
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

        check_config: CheckConfig = validator.save()

        region = [r for r in UPTIME_REGIONS if r.slug == check_config["active_regions"][0]]

        if len(region) == 0:
            return self.respond("No such region", status=400)

        api_endpoint = region[0].api_endpoint

        result = requests.post(
            f"http://{api_endpoint}/validate_check",
            json=check_config,
            timeout=10,
        )

        # A 400-class against the uptime-checker should still mean that this sentry-request was
        # successful.  The result json will contain the error details.
        if result.status_code >= 400 and result.status_code < 500:
            return self.respond(result.json(), status=200)

        result.raise_for_status()
        return self.respond({})
