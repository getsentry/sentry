from __future__ import annotations

import logging

import orjson
from rest_framework import status as status_codes
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.group import STATUS_QUERY_CHOICES, Group
from sentry.models.organization import Organization
from sentry.seer.signed_seer_api import (
    SeerViewerContext,
    SupergroupsByGroupIdsResponse,
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
        try:
            group_ids = [int(gid) for gid in raw_group_ids]
        except ValueError:
            return Response(
                {"detail": "Invalid group_id parameter"},
                status=status_codes.HTTP_400_BAD_REQUEST,
            )

        if not group_ids:
            return Response(
                {"detail": "At least one group_id is required"},
                status=status_codes.HTTP_400_BAD_REQUEST,
            )

        status_param = request.GET.get("status")
        if status_param is not None and status_param not in STATUS_QUERY_CHOICES:
            return Response(
                {"detail": "Invalid status parameter"},
                status=status_codes.HTTP_400_BAD_REQUEST,
            )

        valid_group_ids = set(
            Group.objects.filter(
                id__in=group_ids,
                project__organization=organization,
            ).values_list("id", flat=True)
        )
        group_ids = [gid for gid in group_ids if gid in valid_group_ids]

        if not group_ids:
            return Response(
                {"detail": "No valid group IDs found for this organization"},
                status=status_codes.HTTP_404_NOT_FOUND,
            )

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

        data: SupergroupsByGroupIdsResponse = orjson.loads(response.data)

        if not status_param:
            return Response(data)

        # Seer returns all group_ids per supergroup regardless of status.
        # We can't filter before the Seer call because Seer expands group_ids
        # to include the full supergroup membership, not just the requested IDs.
        # Instead, collect every group_id from the response, check status in
        # bulk, and strip out non-matching ones.
        all_response_group_ids: list[int] = []
        for sg in data["data"]:
            all_response_group_ids.extend(sg["group_ids"])

        matching_ids = set(
            Group.objects.filter(
                id__in=all_response_group_ids,
                project__organization=organization,
                status=STATUS_QUERY_CHOICES[status_param],
            ).values_list("id", flat=True)
        )

        for sg in data["data"]:
            sg["group_ids"] = [gid for gid in sg["group_ids"] if gid in matching_ids]
        # Drop supergroups that have no matching groups after filtering
        data["data"] = [sg for sg in data["data"] if sg["group_ids"]]

        return Response(data)
