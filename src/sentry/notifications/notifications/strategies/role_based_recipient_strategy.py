from __future__ import annotations

from abc import ABCMeta, abstractmethod
from typing import TYPE_CHECKING, Iterable, MutableMapping, Sequence

from sentry.models import OrganizationMember
from sentry.services.hybrid_cloud.user import RpcUser, user_service

if TYPE_CHECKING:
    from sentry.models import Organization, User


class RoleBasedRecipientStrategy(metaclass=ABCMeta):
    member_by_user_id: MutableMapping[int, OrganizationMember] = {}
    member_role_by_user_id: MutableMapping[int, str] = {}

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
            self.member_role_by_user_id[user.id] = OrganizationMember.objects.get(
                user_id=user.id, organization=self.organization
            ).role
        return self.member_role_by_user_id[user.id]

    def set_members_roles_in_cache(self, members: Sequence[OrganizationMember], role: str) -> None:
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

    @abstractmethod
    def determine_member_recipients(self) -> Iterable[OrganizationMember]:
        """
        Depending on the type of request this might be all organization owners,
        a specific person, or something in between.
        """
        raise NotImplementedError

    def build_notification_footer_from_settings_url(
        self, settings_url: str, recipient: User
    ) -> str:
        role = self.get_member_role(recipient)
        return (
            "You are receiving this notification because you're listed as an organization "
            f"{role} | {settings_url}"
        )
