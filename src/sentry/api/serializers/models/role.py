from typing import Any, List, Mapping

from typing_extensions import TypedDict

from sentry.api.serializers import Serializer
from sentry.models import User
from sentry.roles.manager import OrganizationRole, Role, TeamRole


class RoleSerializerResponse(TypedDict):
    id: str
    name: str
    desc: str
    scopes: List[str]
    is_global: bool
    allowed: bool


class RoleSerializer(Serializer):
    def serialize(
        self,
        obj: Role,
        attrs: Mapping[str, Any],
        user: User,
        **kwargs: Any,
    ) -> RoleSerializerResponse:
        allowed_roles = kwargs.get("allowed_roles") or ()

        return {
            "id": str(obj.id),
            "name": obj.name,
            "desc": obj.desc,
            "scopes": obj.scopes,
            "allowed": obj in allowed_roles,
        }


class OrganizationRoleSerializer(RoleSerializer):
    def serialize(self, obj: OrganizationRole, attrs, user, **kwargs):
        serialized = super().serialize(obj, attrs, user, **kwargs)
        serialized.update(
            {
                "is_global": obj.is_global,  # backward compatibility
                "isGlobal": obj.is_global,
                "isRetired": obj.is_retired,
                "minimumTeamRole": obj.get_minimum_team_role().id,
            }
        )
        return serialized


class TeamRoleSerializer(RoleSerializer):
    def serialize(self, obj: TeamRole, attrs, user, **kwargs):
        serialized = super().serialize(obj, attrs, user, **kwargs)
        serialized.update(
            {
                "isMinimumRoleFor": obj.is_minimum_role_for,
            }
        )
        return serialized
