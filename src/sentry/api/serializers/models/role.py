from sentry.api.serializers import Serializer
from sentry.roles.manager import OrganizationRole, TeamRole


class RoleSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
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
