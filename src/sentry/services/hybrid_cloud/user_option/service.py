# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import Any, List, Optional

from sentry.services.hybrid_cloud.auth import AuthenticationContext
from sentry.services.hybrid_cloud.filter_query import OpaqueSerializedResponse
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user_option import RpcUserOption, UserOptionFilterArgs
from sentry.silo import SiloMode


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


class UserOptionService(RpcService):
    key = "user_option"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.user_option.impl import DatabaseBackedUserOptionService

        return DatabaseBackedUserOptionService()

    @rpc_method
    @abstractmethod
    def serialize_many(
        self,
        *,
        filter: UserOptionFilterArgs,
        as_user: Optional[RpcUser] = None,
        auth_context: Optional[AuthenticationContext] = None,
    ) -> List[OpaqueSerializedResponse]:
        pass

    @rpc_method
    @abstractmethod
    def get_many(self, *, filter: UserOptionFilterArgs) -> List[RpcUserOption]:
        pass

    @rpc_method
    @abstractmethod
    def delete_options(self, *, option_ids: List[int]) -> None:
        pass

    @rpc_method
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


user_option_service = UserOptionService.create_delegation()
