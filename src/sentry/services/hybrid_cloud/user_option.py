from __future__ import annotations

from abc import abstractmethod
from typing import Any, Iterable, List, Optional

from sentry.models.options.user_option import UserOption
from sentry.models.project import Project
from sentry.services.hybrid_cloud import (
    CreateStubFromBase,
    InterfaceWithLifecycle,
    silo_mode_delegation,
)
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

    def get_value(self, *, user_id: int, key: str, project: Project | None) -> Any:
        for option in self.get([user_id], key=key, project=project):
            return option.value
        return None


class DatabaseBackedUserOptionService(UserOptionService):
    def get(
        self,
        user_ids: Iterable[int],
        key: str,
        project: Optional[Project],
    ) -> List[UserOption]:
        queryset = UserOption.objects.filter(user_id__in=user_ids, key=key)  # type: ignore
        if project is not None:
            queryset = queryset.filter(project=project)
        return list(queryset)

    def close(self) -> None:
        pass


StubUserOptionService = CreateStubFromBase(DatabaseBackedUserOptionService)

user_option_service: UserOptionService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: lambda: DatabaseBackedUserOptionService(),
        SiloMode.REGION: lambda: StubUserOptionService(),
        SiloMode.CONTROL: lambda: DatabaseBackedUserOptionService(),
    }
)
