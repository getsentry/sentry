from abc import abstractmethod
from typing import Iterable, List, Optional, Sequence

from sentry.models.group import Group
from sentry.models.organizationmember import OrganizationMember
from sentry.models.user import User
from sentry.services.hybrid_cloud import (
    CreateStubFromBase,
    InterfaceWithLifecycle,
    silo_mode_delegation,
)
from sentry.silo import SiloMode


class UserService(InterfaceWithLifecycle):
    @abstractmethod
    def get_users_by_email(self, email: str, is_active=True) -> List[User]:
        """
        Return a list of active users with verified emails matching the parameter
        :param email:
        A case insensitive email to match
        :return:
        """
        pass

    @abstractmethod
    def get_from_group(self, group: Group) -> List[User]:
        """Get all users in all teams in a given Group's project."""
        pass

    @abstractmethod
    def get_users(self, user_ids: Iterable[int], is_active=True) -> List[User]:
        """
        This method returns User objects given an iterable of IDs
        :param user_ids:
        A list of user IDs to fetch
        :return:
        """
        pass

    def get_user(self, user_id: int, is_active=True) -> Optional[User]:
        users = self.get_users([user_id], is_active=is_active)
        if len(users) > 0:
            return users[0]
        else:
            return None


class DatabaseBackedUserService(UserService):
    def get_users_by_email(self, email: str) -> Sequence[User]:
        return User.objects.filter(
            emails__is_verified=True, is_active=True, emails__email__iexact=email
        )

    def get_from_group(self, group: Group) -> List[User]:
        group_memberships = OrganizationMember.objects.filter(
            organization=group.organization,
            teams__in=group.project.teams.all(),
        ).values_list("user_id", flat=True)
        return user_service.get_users(set(group_memberships))

    def get_users(self, user_ids: Iterable[int], is_active=True) -> List[User]:

        query = User.objects.filter(id__in=user_ids)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        return query

    def close(self):
        pass


StubUserService = CreateStubFromBase(DatabaseBackedUserService)

user_service: UserService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: DatabaseBackedUserService,
        SiloMode.REGION: StubUserService,
        SiloMode.CONTROL: DatabaseBackedUserService,
    }
)
