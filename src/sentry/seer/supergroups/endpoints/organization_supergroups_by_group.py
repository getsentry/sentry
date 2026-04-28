from __future__ import annotations

import logging
from typing import Any

from rest_framework import status as status_codes
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.actor import ActorSerializer, ActorSerializerResponse
from sentry.models.group import STATUS_QUERY_CHOICES, Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.organization import Organization
from sentry.models.team import Team
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import SupergroupDetailData
from sentry.seer.supergroups.by_group import get_supergroups_by_group_ids
from sentry.users.services.user.service import user_service

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

        try:
            data = get_supergroups_by_group_ids(organization, group_ids, user_id=request.user.id)
        except SeerApiError as exc:
            return Response({"detail": "Failed to fetch supergroups"}, status=exc.status)

        # Seer returns every group_id in each supergroup regardless of request. We apply any
        # filters from the request after we get the data from Seer.
        if status_param:
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
            data["data"] = [sg for sg in data["data"] if sg["group_ids"]]

        return Response({"data": _add_assignees(organization, data["data"])})


def _add_assignees(
    organization: Organization, supergroups: list[SupergroupDetailData]
) -> list[dict[str, Any]]:
    all_group_ids = {gid for sg in supergroups for gid in sg["group_ids"]}

    group_to_user: dict[int, int] = {}
    group_to_team: dict[int, int] = {}
    for group_id, user_id, team_id in GroupAssignee.objects.filter(
        group_id__in=all_group_ids,
        group__project__organization_id=organization.id,
    ).values_list("group_id", "user_id", "team_id"):
        if user_id is not None:
            group_to_user[group_id] = user_id
        else:
            group_to_team[group_id] = team_id

    users = user_service.get_many_by_id(ids=list(set(group_to_user.values())))
    teams = Team.objects.filter(id__in=set(group_to_team.values()), organization_id=organization.id)
    actor_by_key: dict[tuple[str, int], ActorSerializerResponse] = {
        (a["type"], int(a["id"])): a
        for a in serialize([*users, *teams], serializer=ActorSerializer())
    }

    result: list[dict[str, Any]] = []
    for sg in supergroups:
        keys: set[tuple[str, int]] = set()
        for gid in sg["group_ids"]:
            if gid in group_to_user:
                keys.add(("user", group_to_user[gid]))
            elif gid in group_to_team:
                keys.add(("team", group_to_team[gid]))
        result.append({**sg, "assignees": [actor_by_key[k] for k in keys if k in actor_by_key]})
    return result
