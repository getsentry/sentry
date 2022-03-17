from __future__ import annotations

from typing import Any, Iterable, Mapping, Sequence

from sentry import features
from sentry.api.serializers import serialize
from sentry.api.serializers.models.user import DetailedUserSerializer
from sentry.models import OrganizationMember, User
from sentry.roles.manager import OrganizationRole, Role
from sentry.roles import organization_roles, team_roles

from .. import OrganizationMemberWithTeamsSerializer
from ...role import OrganizationRoleSerializer, TeamRoleSerializer


def is_retired_role_hidden(role: OrganizationRole, member: OrganizationMember) -> bool:
    return (
        role.is_retired
        and role.id != member.role
        and features.has("organizations:team-roles", member.organization)
    )


class OrganizationMemberWithRolesSerializer(OrganizationMemberWithTeamsSerializer):
    def __init__(
        self,
        allowed_roles: Iterable[Role],
        expand: Sequence[str] | None = None,
    ) -> None:
        super().__init__(expand)
        self.allowed_roles = allowed_roles

    def serialize(  # type: ignore
        self,
        obj: OrganizationMember,
        attrs: Mapping[str, Any],
        user: User,
        **kwargs: Any,
    ) -> Mapping[str, Any]:
        context = {**super().serialize(obj, attrs, user, **kwargs)}

        if self.allowed_roles:
            context["invite_link"] = obj.get_invite_link()
            context["user"] = serialize(obj.user, user, DetailedUserSerializer())

        context["isOnlyOwner"] = obj.is_only_owner()

        organization_role_list = [
            role for role in organization_roles.get_all() if not is_retired_role_hidden(role, obj)
        ]
        context["roles"] = serialize(
            organization_role_list,
            serializer=OrganizationRoleSerializer(),
            allowed_roles=self.allowed_roles,
        )

        context["teamRoles"] = serialize(team_roles.get_all(), serializer=TeamRoleSerializer())

        return context
