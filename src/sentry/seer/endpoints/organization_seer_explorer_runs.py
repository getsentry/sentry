from __future__ import annotations

import logging

import orjson
from django.conf import settings
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.net.http import connection_from_url
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.seer.signed_seer_api import make_signed_seer_api_request

logger = logging.getLogger(__name__)

autofix_connection_pool = connection_from_url(settings.SEER_AUTOFIX_URL)


class OrganizationSeerExplorerRunsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
    }


class ExplorerRunsRequestSerializer(serializers.Serializer):
    offset = serializers.IntegerField(required=False, allow_null=False)
    limit = serializers.IntegerField(required=False, allow_null=False)

    def validate_offset(self, value: int) -> int:
        if value < 0:
            raise serializers.ValidationError("Offset must be non-negative")
        return value

    def validate_limit(self, value: int) -> int:
        if value < 1:
            raise serializers.ValidationError("Limit must be greater than 0")
        return value


@region_silo_endpoint
class OrganizationSeerExplorerRunsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    permission_classes = (OrganizationSeerExplorerRunsPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get a list of explorer runs triggered by the requesting user.
        """
        if not features.has("organizations:seer-explorer", organization, actor=request.user):
            return Response({"detail": "Feature flag not enabled"}, status=403)

        has_seer_access, detail = has_seer_access_with_detail(organization, actor=request.user)
        if not has_seer_access:
            return Response({"detail": detail}, status=403)

        if not organization.flags.allow_joinleave:
            return Response(
                {
                    "detail": "Organization does not have open team membership enabled. Seer requires this to aggregate context across all projects and allow members to ask questions freely."
                },
                status=403,
            )

        serializer = ExplorerRunsRequestSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        offset: int | None = serializer.validated_data.get("offset")
        limit: int | None = serializer.validated_data.get("limit")

        path = "/v1/automation/explorer/runs"
        body = orjson.dumps(
            {
                "organization_id": organization.id,
                "user_id": request.user.id,
                "offset": offset,
                "limit": limit,
            },
            option=orjson.OPT_NON_STR_KEYS,
        )

        response = make_signed_seer_api_request(autofix_connection_pool, path, body)
        if response.status < 200 or response.status >= 300:
            logger.error(
                "Seer explorer runs endpoint failed",
                extra={
                    "path": path,
                    "status_code": response.status,
                    "response_data": response.data,
                },
            )
            return Response({"detail": "Internal Server Error"}, status=502)

        return Response(response.json(), status=response.status)
