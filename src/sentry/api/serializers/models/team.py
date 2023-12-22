from __future__ import annotations

import dataclasses
from collections import defaultdict
from datetime import datetime
from typing import (
    TYPE_CHECKING,
    AbstractSet,
    Any,
    Dict,
    FrozenSet,
    List,
    Mapping,
    MutableMapping,
    MutableSequence,
    Optional,
    Sequence,
    Set,
)

from django.db.models import Count
from typing_extensions import TypedDict

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
from sentry.models.integrations.external_actor import ExternalActor
from sentry.models.organization import Organization
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.projectteam import ProjectTeam
from sentry.models.team import Team
from sentry.models.user import User
from sentry.roles import organization_roles, team_roles
from sentry.scim.endpoints.constants import SCIM_SCHEMA_GROUP
from sentry.utils.query import RangeQuerySetWrapper

if TYPE_CHECKING:
    from sentry.api.serializers import SCIMMeta
    from sentry.api.serializers.models.external_actor import ExternalActorResponse
    from sentry.api.serializers.models.project import ProjectSerializerResponse
    from sentry.api.serializers.types import OrganizationSerializerResponse


def _get_team_memberships(
    team_list: Sequence[Team],
    user: User,
    optimization: SingularRpcAccessOrgOptimization | None = None,
) -> Mapping[int, str | None]:
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


def get_member_totals(team_list: Sequence[Team], user: User) -> Mapping[str, int]:
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


def get_member_orgs_and_roles(org_ids: Set[int], user_id: int) -> Mapping[int, Sequence[str]]:
    org_members = OrganizationMember.objects.filter(
        user_id=user_id, organization__in=org_ids
    ).values_list("organization_id", "id", "role")

    if not len(org_members):
        return {}

    _, org_member_ids, _ = zip(*org_members)

    roles_from_teams = (
        OrganizationMemberTeam.objects.filter(organizationmember_id__in=org_member_ids)
        .exclude(team__org_role=None)
        .values_list("organizationmember__organization_id", "team__org_role")
    )

    orgs_and_roles = {orgs: {role} for orgs, _, role in org_members}

    for org_id, org_role in roles_from_teams:
        orgs_and_roles[org_id].add(org_role)

    return {
        org: [r.id for r in organization_roles.get_sorted_roles(org_roles)]
        for org, org_roles in orgs_and_roles.items()
    }


def get_org_roles(
    org_ids: Set[int], user: User, optimization: SingularRpcAccessOrgOptimization | None = None
) -> Mapping[int, Sequence[str]]:
    """
    Get the roles the user has in each org
    Roles are ordered from highest to lower priority (descending priority)
    """
    if not user.is_authenticated:
        return {}

    if optimization:
        if optimization.access.roles is not None:
            return {
                optimization.access.rpc_user_organization_context.organization.id: list(
                    optimization.access.roles
                )
            }
        return {}

    # map of org id to role
    # can have multiple org roles through team membership
    # return them sorted to figure out highest team role
    return get_member_orgs_and_roles(org_ids=org_ids, user_id=user.id)


def get_access_requests(item_list: Sequence[Team], user: User) -> AbstractSet[Team]:
    if user.is_authenticated:
        return frozenset(
            OrganizationAccessRequest.objects.filter(
                team__in=item_list, member__user_id=user.id
            ).values_list("team", flat=True)
        )
    return frozenset()


class _TeamSerializerResponseOptional(TypedDict, total=False):
    externalTeams: List[ExternalActorResponse]
    organization: OrganizationSerializerResponse
    projects: List[ProjectSerializerResponse]
    orgRole: Optional[str]  # TODO(cathy): Change to new key


class BaseTeamSerializerResponse(TypedDict):
    id: str
    slug: str
    name: str
    dateCreated: datetime
    isMember: bool
    teamRole: Optional[str]
    flags: Dict[str, Any]
    access: FrozenSet[str]  # scopes granted by teamRole
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
        self, item_list: Sequence[Team], user: User, **kwargs: Any
    ) -> MutableMapping[Team, MutableMapping[str, Any]]:
        request = env.request
        org_ids: Set[int] = {t.organization_id for t in item_list}

        assert len(org_ids) == 1, "Cross organization query for teams"

        optimization = (
            maybe_singular_rpc_access_org_context(self.access, org_ids) if self.access else None
        )
        roles_by_org = get_org_roles(org_ids, user, optimization=optimization)

        member_totals = get_member_totals(item_list, user)
        team_memberships = _get_team_memberships(item_list, user, optimization=optimization)
        access_requests = get_access_requests(item_list, user)

        is_superuser = request and is_active_superuser(request) and request.user == user
        result: MutableMapping[Team, MutableMapping[str, Any]] = {}
        organization = Organization.objects.get_from_cache(id=list(org_ids)[0])

        for team in item_list:
            is_member = team.id in team_memberships
            org_roles = roles_by_org.get(team.organization_id) or []
            team_role_id, team_role_scopes = team_memberships.get(team.id), set()

            has_access = bool(
                is_member
                or is_superuser
                or organization.flags.allow_joinleave
                or any(roles.get(org_role).is_global for org_role in org_roles)
            )

            if has_access:
                effective_team_role = (
                    team_roles.get(team_role_id) if team_role_id else team_roles.get_default()
                )

                top_org_role = org_roles[0] if org_roles else None
                if is_superuser:
                    top_org_role = organization_roles.get_top_dog().id

                if top_org_role:
                    minimum_team_role = roles.get_minimum_team_role(top_org_role)
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
                project.id: data for project, data in zip(projects, serialize(projects, user))
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
        self, obj: Team, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> BaseTeamSerializerResponse:
        result: BaseTeamSerializerResponse = {
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
        if obj.org_role:
            result["orgRole"] = obj.org_role

        return result


# See TeamSerializerResponse for explanation as to why this is needed
class TeamSerializer(BaseTeamSerializer):
    def serialize(
        self, obj: Team, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> TeamSerializerResponse:
        result = super().serialize(obj, attrs, user, **kwargs)

        # Expandable attributes.
        if self._expand("externalTeams"):
            result["externalTeams"] = attrs["externalTeams"]

        if self._expand("organization"):
            result["organization"] = serialize(obj.organization, user)

        if self._expand("projects"):
            result["projects"] = attrs["projects"]

        return result


class TeamWithProjectsSerializer(TeamSerializer):
    """@deprecated Use `expand` instead."""

    def __init__(self) -> None:
        super().__init__(expand=["projects", "externalTeams"])


def get_scim_teams_members(
    team_list: Sequence[Team],
) -> MutableMapping[Team, MutableSequence[MutableMapping[str, Any]]]:
    # TODO(hybridcloud) Another cross silo join
    members = RangeQuerySetWrapper(
        OrganizationMember.objects.filter(teams__in=team_list)
        .prefetch_related("teams")
        .distinct("id"),
        limit=10000,
    )
    member_map: MutableMapping[Team, MutableSequence[MutableMapping[str, Any]]] = defaultdict(list)
    for member in members:
        for team in member.teams.all():
            member_map[team].append({"value": str(member.id), "display": member.get_email()})
    return member_map


class SCIMTeamMemberListItem(TypedDict):
    value: str
    display: str


class OrganizationTeamSCIMSerializerRequired(TypedDict):
    schemas: List[str]
    id: str
    displayName: str
    meta: SCIMMeta


class OrganizationTeamSCIMSerializerResponse(OrganizationTeamSCIMSerializerRequired, total=False):
    members: List[SCIMTeamMemberListItem]


@dataclasses.dataclass
class TeamMembership:
    user_id: int
    user_email: str
    member_id: int
    team_ids: List[int]


def get_team_memberships(team_ids: List[int]) -> List[TeamMembership]:
    members: Dict[int, TeamMembership] = {}
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
        expand: Optional[Sequence[str]] = None,
    ) -> None:
        self.expand = expand or []

    def get_attrs(
        self, item_list: Sequence[Team], user: Any, **kwargs: Any
    ) -> Mapping[Team, MutableMapping[str, Any]]:

        result: MutableMapping[int, MutableMapping[str, Any]] = {
            team.id: ({"members": []} if "members" in self.expand else {}) for team in item_list
        }
        teams_by_id: Mapping[int, Team] = {t.id: t for t in item_list}

        if teams_by_id and "members" in self.expand:
            team_ids: List[int] = [t.id for t in item_list]
            team_memberships: List[TeamMembership] = get_team_memberships(team_ids=team_ids)

            for team_member in team_memberships:
                for team_id in team_member.team_ids:
                    result[team_id]["members"].append(
                        dict(value=str(team_member.member_id), display=team_member.user_email)
                    )

        return {teams_by_id[team_id]: attrs for team_id, attrs in result.items()}

    def serialize(
        self, obj: Team, attrs: Mapping[str, Any], user: Any, **kwargs: Any
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
