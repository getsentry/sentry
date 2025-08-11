from collections.abc import Collection, Mapping
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.api.serializers import Serializer
from sentry.models.organization import Organization
from sentry.roles.manager import OrganizationRole, Role, TeamRole
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class BaseRoleSerializerResponse(TypedDict):
    id: str
    name: str
    desc: str
    scopes: frozenset[str]

    allowed: bool
    isAllowed: bool
    isRetired: bool
    isTeamRolesAllowed: bool


class OrganizationRoleSerializerResponse(BaseRoleSerializerResponse):
    is_global: bool
    isGlobal: bool
    minimumTeamRole: str


class TeamRoleSerializerResponse(BaseRoleSerializerResponse):
    isMinimumRoleFor: str | None


def _serialize_base_role(
    obj: Role, organization: Organization, *, allowed_roles: Collection[Role] = ()
) -> BaseRoleSerializerResponse:
    has_team_roles = features.has("organizations:team-roles", organization)
    is_retired_role = has_team_roles and obj.is_retired

    return {
        "id": str(obj.id),
        "name": obj.name,
        "desc": obj.desc,
        "scopes": obj.scopes,
        "allowed": obj in allowed_roles,  # backward compatibility
        "isAllowed": obj in allowed_roles,
        "isRetired": is_retired_role,
        "isTeamRolesAllowed": obj.is_team_roles_allowed,
    }


class OrganizationRoleSerializer(Serializer):
    def __init__(self, **kwargs):
        """
        Remove this when deleting "organizations:team-roles" flag
        """
        self.organization = kwargs["organization"]

    def serialize(
        self,
        obj: OrganizationRole,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> OrganizationRoleSerializerResponse:
        base = _serialize_base_role(
            obj, self.organization, allowed_roles=kwargs.get("allowed_roles", ())
        )
        return {
            **base,
            "is_global": obj.is_global,  # backward compatibility
            "isGlobal": obj.is_global,
            "minimumTeamRole": obj.get_minimum_team_role().id,
        }


class TeamRoleSerializer(Serializer):
    def __init__(self, **kwargs):
        """
        Remove this when deleting "organizations:team-roles" flag
        """
        self.organization = kwargs["organization"]

    def serialize(self, obj: TeamRole, attrs, user, **kwargs) -> TeamRoleSerializerResponse:
        base = _serialize_base_role(
            obj, self.organization, allowed_roles=kwargs.get("allowed_roles", ())
        )
        return {
            **base,
            "isMinimumRoleFor": obj.is_minimum_role_for,
        }
