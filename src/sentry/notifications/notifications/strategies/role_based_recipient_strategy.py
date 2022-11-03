from __future__ import annotations

from abc import ABCMeta, abstractmethod
from typing import TYPE_CHECKING, Iterable, MutableMapping

from sentry import roles
from sentry.models import OrganizationMember
from sentry.services.hybrid_cloud.user import APIUser, user_service

if TYPE_CHECKING:
    from sentry.models import Organization, User


class RoleBasedRecipientStrategy(metaclass=ABCMeta):
    member_by_user_id: MutableMapping[int, OrganizationMember] = {}

    def __init__(self, organization: Organization):
        self.organization = organization

    def get_member(self, user: APIUser) -> OrganizationMember:
        # cache the result
        if user.class_name() == "User":
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

    def determine_recipients(
        self,
    ) -> Iterable[APIUser]:
        members = self.determine_member_recipients()
        # store the members in our cache
        for member in members:
            self.set_member_in_cache(member)
        # convert members to users
        return user_service.get_many(member.user_id for member in members)

    @abstractmethod
    def determine_member_recipients(self) -> Iterable[OrganizationMember]:
        """
        Depending on the type of request this might be all organization owners,
        a specific person, or something in between.
        """
        raise NotImplementedError

    def get_role_string(self, member: OrganizationMember) -> str:
        role_string: str = roles.get(member.role).name
        return role_string

    def build_notification_footer_from_settings_url(
        self, settings_url: str, recipient: User
    ) -> str:
        recipient_member = self.get_member(recipient)
        return (
            "You are receiving this notification because you're listed as an organization "
            f"{self.get_role_string(recipient_member)} | {settings_url}"
        )
