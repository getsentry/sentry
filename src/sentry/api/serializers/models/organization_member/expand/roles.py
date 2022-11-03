from __future__ import annotations

from typing import Any, Iterable, Mapping, Sequence, cast

from sentry.api.serializers import serialize
from sentry.api.serializers.models.user import DetailedUserSerializer
from sentry.models import OrganizationMember, User
from sentry.roles import organization_roles, team_roles
from sentry.roles.manager import OrganizationRole, Role

from ...role import OrganizationRoleSerializer, TeamRoleSerializer
from .. import OrganizationMemberWithTeamsSerializer
from ..response import OrganizationMemberWithRolesResponse


def _is_retired_role_hidden(role: OrganizationRole, member: OrganizationMember) -> bool:
    """
    During EA, we will show the role but make it greyed out and prevent the user
    from assigning more people to the role.

    return (
        role.is_retired
        and role.id != member.role
        and features.has("organizations:team-roles", member.organization)
    )
    """
    return False


class OrganizationMemberWithRolesSerializer(OrganizationMemberWithTeamsSerializer):
    def __init__(
        self,
        allowed_roles: Iterable[Role],
        expand: Sequence[str] | None = None,
    ) -> None:
        super().__init__(expand)
        self.allowed_roles = allowed_roles

    def serialize(
        self,
        obj: OrganizationMember,
        attrs: Mapping[str, Any],
        user: User,
        **kwargs: Any,
    ) -> OrganizationMemberWithRolesResponse:
        context = cast(
            OrganizationMemberWithRolesResponse,
            super().serialize(obj, attrs, user, **kwargs),
        )

        if self.allowed_roles:
            context["invite_link"] = obj.get_invite_link()
            context["user"] = serialize(obj.user, user, DetailedUserSerializer())

        context["isOnlyOwner"] = obj.is_only_owner()

        organization_role_list = [
            role for role in organization_roles.get_all() if not _is_retired_role_hidden(role, obj)
        ]
        context["orgRoleList"] = serialize(
            organization_role_list,
            serializer=OrganizationRoleSerializer(organization=obj.organization),
            allowed_roles=self.allowed_roles,
        )
        context["roles"] = context["orgRoleList"]  # deprecated
        context["teamRoleList"] = serialize(
            team_roles.get_all(), serializer=TeamRoleSerializer(organization=obj.organization)
        )

        return context
