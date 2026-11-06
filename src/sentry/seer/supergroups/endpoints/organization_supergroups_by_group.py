from __future__ import annotations

import logging
from collections.abc import Container
from typing import Any

from rest_framework import status as status_codes
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.helpers.group_index import get_group_list
from sentry.api.serializers import serialize
from sentry.api.serializers.models.actor import ActorSerializer, ActorSerializerResponse
from sentry.auth.principal import acting_user_id
from sentry.models.group import STATUS_QUERY_CHOICES, Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.organization import Organization
from sentry.models.team import Team
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import SupergroupDetailData
from sentry.seer.supergroups.by_group import get_supergroups_by_group_ids
from sentry.users.services.user.service import user_service

logger = logging.getLogger(__name__)

# When the union of group_ids across all supergroups exceeds this, we skip the
# per-group fan-out: the status filter (which would prune resolved ids from
# each supergroup) and assignee lookups. Counts/group_ids then reflect what
# Seer returned, and assignees come back empty.
_MAX_GROUPS_FOR_FETCH = 100


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

        projects = self.get_projects(request, organization)
        valid_group_ids = {g.id for g in get_group_list(organization.id, projects, group_ids)}
        group_ids = [gid for gid in group_ids if gid in valid_group_ids]

        if not group_ids:
            return Response(
                {"detail": "No valid group IDs found for this organization"},
                status=status_codes.HTTP_404_NOT_FOUND,
            )

        try:
            data = get_supergroups_by_group_ids(
                organization, group_ids, user_id=acting_user_id(request.user)
            )
        except SeerApiError as exc:
            return Response({"detail": "Failed to fetch supergroups"}, status=exc.status)

        # Seer returns every group_id in each supergroup regardless of request, including
        # groups in projects the caller can't access. One lookup gives us both the access
        # check and the statuses for the status filter.
        project_ids = {p.id for p in projects}
        status_by_group_id = dict(
            Group.objects.filter(
                id__in={gid for sg in data["data"] for gid in sg["group_ids"]},
                project_id__in=project_ids,
            ).values_list("id", "status")
        )
        supergroups = _filter_supergroups(data["data"], status_by_group_id.keys(), project_ids)
        if len(status_by_group_id) > _MAX_GROUPS_FOR_FETCH:
            return Response({"data": supergroups, "meta": {"estimated": True}})

        if status_param:
            wanted_status = STATUS_QUERY_CHOICES[status_param]
            matching_ids = {gid for gid, s in status_by_group_id.items() if s == wanted_status}
            supergroups = _filter_supergroups(supergroups, matching_ids, project_ids)

        return Response(
            {
                "data": _add_assignees(organization, supergroups),
                "meta": {"estimated": False},
            }
        )


def _filter_supergroups(
    supergroups: list[SupergroupDetailData],
    keep_group_ids: Container[int],
    project_ids: Container[int],
) -> list[SupergroupDetailData]:
    result: list[SupergroupDetailData] = []
    for sg in supergroups:
        group_ids = [gid for gid in sg["group_ids"] if gid in keep_group_ids]
        if group_ids:
            result.append(
                {
                    **sg,
                    "group_ids": group_ids,
                    "project_ids": [pid for pid in sg.get("project_ids", []) if pid in project_ids],
                }
            )
    return result


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
