# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from dataclasses import dataclass
from typing import Any, Iterable, List, Optional, TypedDict

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.services.hybrid_cloud.auth import AuthenticationContext
from sentry.services.hybrid_cloud.filter_query import OpaqueSerializedResponse
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.silo import SiloMode


@dataclass
class RpcUserOption:
    id: int = -1
    user_id: int = -1
    value: Any = None
    key: str = ""
    project_id: Optional[int] = None
    organization_id: Optional[int] = None


def get_option_from_list(
    options: List[RpcUserOption],
    *,
    key: Optional[str] = None,
    user_id: Optional[int] = None,
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
    keys: List[str]
    key: str
    project_id: Optional[int]
    organization_id: Optional[int]


class UserOptionService(InterfaceWithLifecycle):
    @abstractmethod
    def serialize_many(
        self,
        *,
        filter: UserOptionFilterArgs,
        as_user: Optional[RpcUser] = None,
        auth_context: Optional[AuthenticationContext] = None,
    ) -> List[OpaqueSerializedResponse]:
        pass

    @abstractmethod
    def get_many(self, *, filter: UserOptionFilterArgs) -> List[RpcUserOption]:
        pass

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
        project_id: Optional[int] = None,
        organization_id: Optional[int] = None,
    ) -> None:
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
