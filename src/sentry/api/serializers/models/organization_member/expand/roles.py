from __future__ import annotations

from typing import Any, Iterable, Mapping, Sequence

from sentry import roles
from sentry.api.serializers import serialize
from sentry.api.serializers.models.role import RoleSerializer
from sentry.api.serializers.models.user import DetailedUserSerializer
from sentry.models import OrganizationMember, User
from sentry.roles.manager import Role

from .. import OrganizationMemberWithTeamsSerializer


class OrganizationMemberWithRolesSerializer(OrganizationMemberWithTeamsSerializer):
    def __init__(
        self,
        can_admin: bool,
        allowed_roles: Iterable[Role],
        expand: Sequence[str] | None = None,
    ) -> None:
        super().__init__(expand)
        self.can_admin = can_admin
        self.allowed_roles = allowed_roles

    def serialize(  # type: ignore
        self,
        obj: OrganizationMember,
        attrs: Mapping[str, Any],
        user: User,
        **kwargs: Any,
    ) -> Mapping[str, Any]:
        context = {**super().serialize(obj, attrs, user, **kwargs)}

        if self.can_admin:
            context["invite_link"] = obj.get_invite_link()
            context["user"] = serialize(obj.user, user, DetailedUserSerializer())

        context["isOnlyOwner"] = obj.is_only_owner()
        context["roles"] = serialize(
            roles.get_all(), serializer=RoleSerializer(), allowed_roles=self.allowed_roles
        )

        return context
