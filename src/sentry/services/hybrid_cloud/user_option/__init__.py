from abc import abstractmethod
from typing import Iterable, List, Optional

from sentry.models import Project, UserOption
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.silo import SiloMode


class UserOptionService(InterfaceWithLifecycle):
    @abstractmethod
    def get(
        self,
        user_ids: Iterable[int],
        key: str,
        project: Optional[Project],
    ) -> List[UserOption]:
        """
        This method returns UserOption objects based on the passed in filters
        :param user_ids:
        A list of user IDs to fetch
        :param project:
        Filter options to a specific project
        :param key:
        Filter options to a specific key
        :return:
        """
        pass


def impl_with_db() -> UserOptionService:
    from sentry.services.hybrid_cloud.user_option.impl import DatabaseBackedUserOptionService

    return DatabaseBackedUserOptionService()


user_option_service: UserOptionService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.REGION: stubbed(impl_with_db, SiloMode.CONTROL),
        SiloMode.CONTROL: impl_with_db,
    }
)
