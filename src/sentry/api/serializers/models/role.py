from typing import Any, List, Mapping, Optional

from typing_extensions import TypedDict

from sentry import features
from sentry.api.serializers import Serializer
from sentry.models.user import User
from sentry.roles.manager import OrganizationRole, Role, TeamRole


class BaseRoleSerializerResponse(TypedDict):
    id: str
    name: str
    desc: str
    scopes: List[str]

    allowed: bool
    isAllowed: bool
    isRetired: bool


class OrganizationRoleSerializerResponse(BaseRoleSerializerResponse):
    is_global: bool
    isGlobal: bool
    minimumTeamRole: str


class TeamRoleSerializerResponse(BaseRoleSerializerResponse):
    isMinimumRoleFor: Optional[str]


class RoleSerializer(Serializer):
    def __init__(self, **kwargs):
        """
        Remove this when deleting "organization:team-roles" flag
        """
        self.organization = kwargs["organization"]

    def serialize(
        self,
        obj: Role,
        attrs: Mapping[str, Any],
        user: User,
        **kwargs: Any,
    ) -> BaseRoleSerializerResponse:
        has_team_roles = features.has("organizations:team-roles", self.organization)
        is_retired_role = has_team_roles and obj.is_retired

        allowed_roles = kwargs.get("allowed_roles") or ()

        return {
            "id": str(obj.id),
            "name": obj.name,
            "desc": obj.desc,
            "scopes": obj.scopes,
            "allowed": obj in allowed_roles,  # backward compatibility
            "isAllowed": obj in allowed_roles,
            "isRetired": is_retired_role,
        }


class OrganizationRoleSerializer(RoleSerializer):
    def serialize(
        self, obj: OrganizationRole, attrs, user, **kwargs
    ) -> OrganizationRoleSerializerResponse:
        serialized = super().serialize(obj, attrs, user, **kwargs)
        serialized.update(
            {
                "is_global": obj.is_global,  # backward compatibility
                "isGlobal": obj.is_global,
                "minimumTeamRole": obj.get_minimum_team_role().id,
            }
        )
        return serialized


class TeamRoleSerializer(RoleSerializer):
    def serialize(self, obj: TeamRole, attrs, user, **kwargs) -> TeamRoleSerializerResponse:
        serialized = super().serialize(obj, attrs, user, **kwargs)
        serialized.update(
            {
                "isMinimumRoleFor": obj.is_minimum_role_for,
            }
        )
        return serialized
