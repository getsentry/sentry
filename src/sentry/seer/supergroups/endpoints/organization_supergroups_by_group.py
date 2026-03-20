from __future__ import annotations

import logging

import orjson
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.seer.signed_seer_api import (
    SeerViewerContext,
    make_supergroups_get_by_group_ids_request,
)

logger = logging.getLogger(__name__)


class OrganizationSupergroupsByGroupPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
    }


@cell_silo_endpoint
class OrganizationSupergroupsByGroupEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUE_DETECTION_BACKEND
    permission_classes = (OrganizationSupergroupsByGroupPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:top-issues-ui", organization, actor=request.user):
            return Response({"detail": "Feature not available"}, status=403)

        raw_group_ids = request.GET.getlist("group_id")
        group_ids = [int(gid) for gid in raw_group_ids]

        response = make_supergroups_get_by_group_ids_request(
            {"organization_id": organization.id, "group_ids": group_ids},
            SeerViewerContext(organization_id=organization.id, user_id=request.user.id),
            timeout=10,
        )

        if response.status >= 400:
            return Response(
                {"detail": "Failed to fetch supergroups"},
                status=response.status,
            )

        return Response(orjson.loads(response.data))
