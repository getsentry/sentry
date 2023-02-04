from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass, field
from typing import Any, Iterable, List, Optional, TypedDict

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.services.hybrid_cloud.filter_query import FilterQueryInterface
from sentry.silo import SiloMode


@dataclass
class ApiUserOption:
    id: int = -1
    user_id: int = -1
    value: Any = None
    key: str = ""
    project_id: int | None = None
    organization_id: int | None = None


@dataclass
class ApiUserOptionSet:
    options: List[ApiUserOption] = field(default_factory=list)

    def get_one(
        self,
        *,
        key: str | None = None,
        user_id: int | None = None,
        default: Any = None,
    ) -> Any:

        for option in self.options:
            if key is not None and option.key != key:
                continue
            if user_id is not None and option.user_id != user_id:
                continue
            return option.value
        return default


def get_option_from_list(
    options: List[ApiUserOption],
    *,
    key: str | None = None,
    user_id: int | None = None,
    default: Any = None,
) -> Any:
    for option in options:
        if key is not None and option.key != key:
            continue
        if user_id is not None and option.user_id != user_id:
            continue
        return option.value
    return default


class UserOptionFilterArgs(TypedDict, total=False):
    user_ids: Iterable[int]
    keys: List[str] | None
    key: str | None
    project_id: Optional[int]
    organization_id: Optional[int]


class UserOptionService(
    FilterQueryInterface[UserOptionFilterArgs, ApiUserOptionSet, None], InterfaceWithLifecycle
):
    @abstractmethod
    def delete_options(self, *, option_ids: List[int]) -> None:
        pass

    @abstractmethod
    def set_option(
        self,
        *,
        user_id: int,
        value: Any,
        key: str,
        project_id: int | None = None,
        organization_id: int | None = None,
    ) -> None:
        pass

    # @abstractmethod
    # def query_options(
    #     self,
    #     *,
    #     user_ids: Iterable[int],
    #     keys: List[str] | None = None,
    #     key: str | None = None,
    #     project_id: Optional[int] = None,
    #     organization_id: Optional[int] = None,
    # ) -> ApiUserOptionSet:
    #     pass


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
