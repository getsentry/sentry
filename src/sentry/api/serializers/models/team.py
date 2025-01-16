from __future__ import annotations

import dataclasses
from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import TYPE_CHECKING, Any, TypedDict

from django.contrib.auth.models import AnonymousUser
from django.db.models import Count

from sentry import roles
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.types import SerializedAvatarFields
from sentry.app import env
from sentry.auth.access import (
    Access,
    SingularRpcAccessOrgOptimization,
    maybe_singular_rpc_access_org_context,
)
from sentry.auth.superuser import is_active_superuser
from sentry.integrations.models.external_actor import ExternalActor
from sentry.models.organization import Organization
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.projectteam import ProjectTeam
from sentry.models.team import Team
from sentry.roles import organization_roles, team_roles
from sentry.scim.endpoints.constants import SCIM_SCHEMA_GROUP
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.query import RangeQuerySetWrapper

if TYPE_CHECKING:
    from sentry.api.serializers import SCIMMeta
    from sentry.api.serializers.models.project import ProjectSerializerResponse
    from sentry.api.serializers.types import OrganizationSerializerResponse
    from sentry.integrations.api.serializers.models.external_actor import ExternalActorResponse


def _get_team_memberships(
    team_list: Sequence[Team],
    user: User | RpcUser | AnonymousUser,
    optimization: SingularRpcAccessOrgOptimization | None = None,
) -> dict[int, str | None]:
    """Get memberships the user has in the provided team list"""
    if not user.is_authenticated:
        return {}

    if optimization:
        return {
            member.team_id: member.role.id if member.role else None
            for team in team_list
            for member in [optimization.access.get_team_membership(team.id)]
            if member is not None
        }

    return {
        team_id: team_role
        for (team_id, team_role) in OrganizationMemberTeam.objects.filter(
            organizationmember__user_id=user.id, team__in=team_list
        ).values_list("team__id", "role")
    }


def get_member_totals(
    team_list: Sequence[Team], user: User | RpcUser | AnonymousUser
) -> dict[int, int]:
    """Get the total number of members in each team"""
    if not user.is_authenticated:
        return {}

    query = (
        Team.objects.filter(
            id__in=[t.pk for t in team_list],
            organizationmember__invite_status=InviteStatus.APPROVED.value,
        )
        .annotate(member_count=Count("organizationmemberteam"))
        .values("id", "member_count")
    )
    return {item["id"]: item["member_count"] for item in query}


def get_org_roles(
    org_ids: set[int],
    user: User | RpcUser | AnonymousUser,
    optimization: SingularRpcAccessOrgOptimization | None = None,
) -> dict[int, str]:
    """
    Get the roles the user has in each org
    """
    if not user.is_authenticated:
        return {}

    if optimization:
        if optimization.access.role is not None:
            return {
                optimization.access.api_user_organization_context.organization.id: optimization.access.role
            }
        return {}

    # map of org id to role
    return {
        om["organization_id"]: om["role"]
        for om in OrganizationMember.objects.filter(
            user_id=user.id, organization__in=set(org_ids)
        ).values("role", "organization_id")
    }


def get_access_requests(
    item_list: Sequence[Team], user: User | RpcUser | AnonymousUser
) -> frozenset[int]:
    if user.is_authenticated:
        return frozenset(
            OrganizationAccessRequest.objects.filter(
                team__in=item_list, member__user_id=user.id
            ).values_list("team", flat=True)
        )
    return frozenset()


class _TeamSerializerResponseOptional(TypedDict, total=False):
    externalTeams: list[ExternalActorResponse]
    organization: OrganizationSerializerResponse
    projects: list[ProjectSerializerResponse]


class BaseTeamSerializerResponse(TypedDict):
    id: str
    slug: str
    name: str
    dateCreated: datetime | None
    isMember: bool
    teamRole: str | None
    flags: dict[str, Any]
    access: frozenset[str]  # scopes granted by teamRole
    hasAccess: bool
    isPending: bool
    memberCount: int
    avatar: SerializedAvatarFields


# We require a third Team Response TypedDict that inherits like so:
# TeamSerializerResponse
#   * BaseTeamSerializerResponse
#   * _TeamSerializerResponseOptional
# instead of having this inheritance:
# BaseTeamSerializerResponse
#   * _TeamSerializerResponseOptional
# b/c of how drf-spectacular builds schema using @extend_schema. When specifying a DRF serializer
# as a response, the schema will include all optional fields even if the response body for that
# request never includes those fields. There is no way to have a single serializer that we can
# manipulate to exclude optional fields at will, so we need two separate serializers where one
# returns the base response fields, and the other returns the combined base+optional response fields
class TeamSerializerResponse(BaseTeamSerializerResponse, _TeamSerializerResponseOptional):
    pass


@register(Team)
class BaseTeamSerializer(Serializer):
    expand: Sequence[str] | None
    collapse: Sequence[str] | None
    access: Access | None

    def __init__(
        self,
        collapse: Sequence[str] | None = None,
        expand: Sequence[str] | None = None,
        access: Access | None = None,
    ):
        self.collapse = collapse
        self.expand = expand
        self.access = access

    def _expand(self, key: str) -> bool:
        if self.expand is None:
            return False

        return key in self.expand

    def _collapse(self, key: str) -> bool:
        if self.collapse is None:
            return False
        return key in self.collapse

    def get_attrs(
        self, item_list: Sequence[Team], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> dict[Team, dict[str, Any]]:
        from sentry.api.serializers.models.project import ProjectSerializer

        request = env.request
        org_ids = {t.organization_id for t in item_list}

        assert len(org_ids) == 1, "Cross organization query for teams"

        optimization = (
            maybe_singular_rpc_access_org_context(self.access, org_ids) if self.access else None
        )
        roles_by_org = get_org_roles(org_ids, user, optimization=optimization)

        member_totals = get_member_totals(item_list, user)
        team_memberships = _get_team_memberships(item_list, user, optimization=optimization)
        access_requests = get_access_requests(item_list, user)

        is_superuser = request and is_active_superuser(request) and request.user == user
        result: dict[Team, dict[str, Any]] = {}
        organization = Organization.objects.get_from_cache(id=list(org_ids)[0])

        for team in item_list:
            is_member = team.id in team_memberships
            org_role = roles_by_org.get(team.organization_id)
            team_role_id = team_memberships.get(team.id)
            team_role_scopes: frozenset[str] = frozenset()

            has_access = bool(
                is_member
                or is_superuser
                or organization.flags.allow_joinleave
                or (org_role and roles.get(org_role).is_global)
            )

            if has_access:
                effective_team_role = (
                    team_roles.get(team_role_id) if team_role_id else team_roles.get_default()
                )

                if is_superuser:
                    org_role = organization_roles.get_top_dog().id

                if org_role:
                    minimum_team_role = roles.get_minimum_team_role(org_role)
                    if minimum_team_role.priority > effective_team_role.priority:
                        effective_team_role = minimum_team_role

                team_role_scopes = effective_team_role.scopes
                team_role_id = effective_team_role.id

            result[team] = {
                "pending_request": team.id in access_requests,
                "is_member": is_member,
                "team_role": team_role_id if is_member else None,
                "access": team_role_scopes,
                "has_access": has_access,
                "member_count": member_totals.get(team.id, 0),
            }

        if self._expand("projects"):
            project_teams = ProjectTeam.objects.get_for_teams_with_org_cache(item_list)
            projects = [pt.project for pt in project_teams]

            projects_by_id = {
                project.id: data
                for project, data in zip(
                    projects,
                    serialize(projects, user, ProjectSerializer(collapse=["unusedFeatures"])),
                )
            }

            project_map = defaultdict(list)
            for project_team in project_teams:
                project_map[project_team.team_id].append(projects_by_id[project_team.project_id])

            for team in item_list:
                result[team]["projects"] = project_map[team.id]

        if self._expand("externalTeams"):
            external_actors = list(
                ExternalActor.objects.filter(team_id__in={team.id for team in item_list})
            )

            external_teams_map = defaultdict(list)
            serialized_list = serialize(external_actors, user, key="team")
            for serialized in serialized_list:
                external_teams_map[serialized["teamId"]].append(serialized)

            for team in item_list:
                result[team]["externalTeams"] = external_teams_map[str(team.id)]

        return result

    def serialize(
        self,
        obj: Team,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> BaseTeamSerializerResponse:
        return {
            "id": str(obj.id),
            "slug": obj.slug,
            "name": obj.name,
            "dateCreated": obj.date_added,
            "isMember": attrs["is_member"],
            "teamRole": attrs["team_role"],
            "flags": {"idp:provisioned": bool(obj.idp_provisioned)},
            "access": attrs["access"],
            "hasAccess": attrs["has_access"],
            "isPending": attrs["pending_request"],
            "memberCount": attrs["member_count"],
            # Teams only have letter avatars.
            "avatar": {"avatarType": "letter_avatar", "avatarUuid": None},
        }


# See TeamSerializerResponse for explanation as to why this is needed
class TeamSerializer(BaseTeamSerializer):
    def serialize(
        self,
        obj: Team,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> TeamSerializerResponse:
        result = super().serialize(obj, attrs, user, **kwargs)

        opt: _TeamSerializerResponseOptional = {}

        # Expandable attributes.
        if self._expand("externalTeams"):
            opt["externalTeams"] = attrs["externalTeams"]

        if self._expand("organization"):
            opt["organization"] = serialize(obj.organization, user)

        if self._expand("projects"):
            opt["projects"] = attrs["projects"]

        return {**result, **opt}


class TeamWithProjectsSerializer(TeamSerializer):
    """@deprecated Use `expand` instead."""

    def __init__(self) -> None:
        super().__init__(expand=["projects", "externalTeams"])


class SCIMTeamMemberListItem(TypedDict):
    value: str
    display: str


class OrganizationTeamSCIMSerializerRequired(TypedDict):
    schemas: list[str]
    id: str
    displayName: str
    meta: SCIMMeta


class OrganizationTeamSCIMSerializerResponse(OrganizationTeamSCIMSerializerRequired, total=False):
    members: list[SCIMTeamMemberListItem]


@dataclasses.dataclass
class TeamMembership:
    user_id: int
    user_email: str
    member_id: int
    team_ids: list[int]


def get_team_memberships(team_ids: list[int]) -> list[TeamMembership]:
    members: dict[int, TeamMembership] = {}
    for omt in RangeQuerySetWrapper(
        OrganizationMemberTeam.objects.filter(team_id__in=team_ids).prefetch_related(
            "organizationmember"
        )
    ):
        if omt.organizationmember_id not in members:
            members[omt.organizationmember_id] = TeamMembership(
                user_id=omt.organizationmember.user_id,
                user_email=omt.organizationmember.get_email(),
                member_id=omt.organizationmember_id,
                team_ids=[],
            )
        members[omt.organizationmember_id].team_ids.append(omt.team_id)

    return list(members.values())


class TeamSCIMSerializer(Serializer):
    def __init__(
        self,
        expand: Sequence[str] | None = None,
    ) -> None:
        self.expand = expand or []

    def get_attrs(
        self, item_list: Sequence[Team], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> dict[Team, dict[str, Any]]:

        result: dict[int, dict[str, Any]] = {
            team.id: ({"members": []} if "members" in self.expand else {}) for team in item_list
        }
        teams_by_id = {t.id: t for t in item_list}

        if teams_by_id and "members" in self.expand:
            team_ids = [t.id for t in item_list]
            team_memberships = get_team_memberships(team_ids=team_ids)

            for team_member in team_memberships:
                for team_id in team_member.team_ids:
                    result[team_id]["members"].append(
                        dict(value=str(team_member.member_id), display=team_member.user_email)
                    )

        return {teams_by_id[team_id]: attrs for team_id, attrs in result.items()}

    def serialize(
        self,
        obj: Team,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> OrganizationTeamSCIMSerializerResponse:
        result: OrganizationTeamSCIMSerializerResponse = {
            "schemas": [SCIM_SCHEMA_GROUP],
            "id": str(obj.id),
            "displayName": obj.name,
            "meta": {"resourceType": "Group"},
        }
        if "members" in attrs:
            result["members"] = attrs["members"]

        return result
