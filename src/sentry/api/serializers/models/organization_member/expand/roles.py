from __future__ import annotations

from collections.abc import Iterable, Mapping, MutableMapping, Sequence
from typing import Any, cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import serialize
from sentry.models.organizationmember import OrganizationMember
from sentry.roles import organization_roles, team_roles
from sentry.roles.manager import OrganizationRole, Role
from sentry.users.models.user import User
from sentry.users.services.user import UserSerializeType
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service

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

    def get_attrs(
        self,
        item_list: Sequence[OrganizationMember],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[OrganizationMember, MutableMapping[str, Any]]:
        result = super().get_attrs(item_list, user, **kwargs)
        users_by_id = {
            u["id"]: u
            for u in user_service.serialize_many(
                filter=dict(user_ids=[om.user_id for om in item_list if om.user_id is not None]),
                serializer=UserSerializeType.DETAILED,
            )
        }
        for item in item_list:
            result.setdefault(item, {})["serializedUser"] = users_by_id.get(str(item.user_id), {})
        return result

    def serialize(
        self,
        obj: OrganizationMember,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> OrganizationMemberWithRolesResponse:
        context = cast(
            OrganizationMemberWithRolesResponse,
            super().serialize(obj, attrs, user, **kwargs),
        )

        if self.allowed_roles:
            context["user"] = attrs.get("serializedUser", {})

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
