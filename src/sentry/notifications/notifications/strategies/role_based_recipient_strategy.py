from __future__ import annotations

from abc import ABCMeta
from typing import TYPE_CHECKING, Iterable, MutableMapping, Optional

from sentry import roles
from sentry.models import OrganizationMember
from sentry.roles import organization_roles
from sentry.roles.manager import OrganizationRole
from sentry.services.hybrid_cloud.user import RpcUser, user_service

if TYPE_CHECKING:
    from sentry.models import Organization, User


class RoleBasedRecipientStrategy(metaclass=ABCMeta):
    member_by_user_id: MutableMapping[int, OrganizationMember] = {}
    member_role_by_user_id: MutableMapping[int, str] = {}
    role: Optional[OrganizationRole] = None
    scope: Optional[str] = None

    def __init__(self, organization: Organization):
        self.organization = organization

    def get_member(self, user: RpcUser) -> OrganizationMember:
        # cache the result
        if user.class_name() != "User":
            raise OrganizationMember.DoesNotExist()
        if user.id not in self.member_by_user_id:
            self.member_by_user_id[user.id] = OrganizationMember.objects.get(
                user_id=user.id, organization=self.organization
            )
        return self.member_by_user_id[user.id]

    def set_member_in_cache(self, member: OrganizationMember) -> None:
        """
        A way to set a member in a cache to avoid a query.
        """
        self.member_by_user_id[member.user_id] = member

    def get_member_role(self, user: APIUser) -> str:
        # cache the result
        if user.class_name() != "User":
            raise OrganizationMember.DoesNotExist()
        if user.id not in self.member_role_by_user_id:
            role = OrganizationMember.objects.get(
                user_id=user.id, organization=self.organization
            ).role
            self.member_role_by_user_id[user.id] = organization_roles.get(role).name
        return self.member_role_by_user_id[user.id]

    def set_members_roles_in_cache(self, members: Iterable[OrganizationMember], role: str) -> None:
        for member in members:
            self.member_role_by_user_id[member.id] = role

    def determine_recipients(
        self,
    ) -> Iterable[RpcUser]:
        members = self.determine_member_recipients()
        # store the members in our cache
        for member in members:
            self.set_member_in_cache(member)
        # convert members to users
        return user_service.get_many(filter={"user_ids": [member.user_id for member in members]})

    def determine_member_recipients(self) -> Iterable[OrganizationMember]:
        """
        Depending on the type of request this might be all organization owners,
        a specific person, or something in between.
        """
        members: Iterable[
            OrganizationMember
        ] = OrganizationMember.objects.get_contactable_members_for_org(self.organization.id)

        if not self.scope and not self.role:
            return members

        # you can either set the scope or the role for now
        # if both are set we use the scope
        valid_roles = []
        if self.role and not self.scope:
            valid_roles = [self.role.id]
        elif self.scope:
            valid_roles = [r.id for r in roles.get_all() if r.has_scope(self.scope)]

        member_ids = self.organization.get_members_with_org_roles(roles=valid_roles).values_list(
            "id", flat=True
        )
        # ignore type because of optional filtering
        members = members.filter(id__in=member_ids)  # type: ignore[attr-defined]

        if self.role and not self.scope:
            self.set_members_roles_in_cache(members, self.role.name)
        elif self.scope:
            for member in members:
                self.member_role_by_user_id[member.id] = member.get_all_org_roles_sorted()[0].name

        return members

    def build_notification_footer_from_settings_url(
        self, settings_url: str, recipient: User
    ) -> str:
        role = self.get_member_role(recipient)
        return (
            "You are receiving this notification because you're listed as an organization "
            f"{role} | {settings_url}"
        )
