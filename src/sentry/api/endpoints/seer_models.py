from __future__ import annotations

import logging
from typing import TypedDict

import requests
from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import APIException
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


class SeerTimeoutError(APIException):
    status_code = 504
    default_detail = "Request to Seer timed out"


class SeerConnectionError(APIException):
    status_code = 502
    default_detail = "Failed to fetch models from Seer"


class SeerModelsResponse(TypedDict):
    """Response containing list of actively used LLM model names from Seer."""

    models: list[str]


@extend_schema(tags=["Seer"])
@region_silo_endpoint
class SeerModelsEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ML_AI
    permission_classes = ()

    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=100, window=60),
            }
        }
    )

    @extend_schema(
        operation_id="List Seer AI Models",
        responses={
            200: inline_sentry_response_serializer("SeerModelsResponse", SeerModelsResponse),
        },
    )
    def get(self, request: Request) -> Response:
        """
        Get list of actively used LLM model names from Seer.

        Returns the list of AI models that are currently used in production in Seer.
        This endpoint does not require authentication and can be used to discover which models Seer uses.
        """
        path = "/v1/models"

        try:
            response = requests.get(
                f"{settings.SEER_AUTOFIX_URL}{path}",
                headers={
                    "content-type": "application/json;charset=utf-8",
                    **sign_with_seer_secret(b""),
                },
                timeout=5,
            )
            response.raise_for_status()

            data = response.json()
            return Response(data, status=200)

        except requests.exceptions.Timeout:
            logger.warning("Timeout when fetching models from Seer")
            raise SeerTimeoutError()
        except requests.exceptions.RequestException as e:
            logger.exception("Error fetching models from Seer", extra={"error": str(e)})
            raise SeerConnectionError()
