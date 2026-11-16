from collections.abc import Collection, Mapping
from typing import Annotated, Any, TypedDict, cast

from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.api.serializers import Serializer
from sentry.apidocs.descriptions import ApiDescription
from sentry.models.organization import Organization
from sentry.roles.manager import OrganizationRole, Role, TeamRole
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class BaseRoleSerializerResponse(TypedDict):
    id: Annotated[str, ApiDescription("Role ID, such as member or admin")]
    name: Annotated[str, ApiDescription("Display name of the role")]
    desc: Annotated[str, ApiDescription("Description of what the role can do")]
    scopes: Annotated[frozenset[str], ApiDescription("Scopes the role grants in this organization")]

    allowed: Annotated[bool, ApiDescription("Deprecated alias of isAllowed")]
    isAllowed: Annotated[bool, ApiDescription("Whether the requesting user can assign this role")]
    isRetired: Annotated[
        bool,
        ApiDescription("Whether the role is retired and shouldn't be assigned to more members"),
    ]
    isTeamRolesAllowed: Annotated[
        bool, ApiDescription("Whether members with this role can have team-level roles")
    ]


class OrganizationRoleSerializerResponse(BaseRoleSerializerResponse):
    is_global: Annotated[bool, ApiDescription("Deprecated alias of isGlobal")]
    isGlobal: Annotated[
        bool,
        ApiDescription(
            "Whether the role gives access to all teams and projects in the organization"
        ),
    ]
    minimumTeamRole: Annotated[
        str,
        ApiDescription(
            "ID of the lowest team role that members with this organization role hold on every team"
        ),
    ]


class TeamRoleSerializerResponse(BaseRoleSerializerResponse):
    isMinimumRoleFor: Annotated[
        str | None,
        ApiDescription(
            "ID of the organization role whose members hold at least this team role on every team, or null"
        ),
    ]


def _serialize_base_role(
    obj: Role, organization: Organization, *, allowed_roles: Collection[Role] = ()
) -> BaseRoleSerializerResponse:
    has_team_roles = features.has("organizations:team-roles", organization)
    is_retired_role = has_team_roles and obj.is_retired

    return {
        "id": str(obj.id),
        "name": obj.name,
        "desc": obj.desc,
        "scopes": organization.get_role_scopes(obj),
        "allowed": obj in allowed_roles,  # backward compatibility
        "isAllowed": obj in allowed_roles,
        "isRetired": is_retired_role,
        "isTeamRolesAllowed": obj.is_team_roles_allowed,
    }


class OrganizationRoleSerializer(Serializer[OrganizationRoleSerializerResponse]):
    def __init__(self, **kwargs: object) -> None:
        """
        Remove this when deleting "organizations:team-roles" flag
        """
        self.organization = cast(Organization, kwargs["organization"])

    def serialize(
        self,
        obj: OrganizationRole,
        attrs: Mapping[str, object],
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


class TeamRoleSerializer(Serializer[TeamRoleSerializerResponse]):
    def __init__(self, **kwargs: object) -> None:
        """
        Remove this when deleting "organizations:team-roles" flag
        """
        self.organization = cast(Organization, kwargs["organization"])

    def serialize(
        self,
        obj: TeamRole,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> TeamRoleSerializerResponse:
        base = _serialize_base_role(
            obj,
            self.organization,
            allowed_roles=cast(Collection[Role], kwargs.get("allowed_roles", ())),
        )
        return {
            **base,
            "isMinimumRoleFor": obj.is_minimum_role_for,
        }
