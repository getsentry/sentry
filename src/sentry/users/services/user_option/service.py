# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import Any

from sentry.auth.services.auth import AuthenticationContext
from sentry.hybridcloud.rpc.filter_query import OpaqueSerializedResponse
from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.silo.base import SiloMode
from sentry.users.services.user import RpcUser
from sentry.users.services.user_option import RpcUserOption, UserOptionFilterArgs


def get_option_from_list(
    options: list[RpcUserOption],
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


class UserOptionService(RpcService):
    key = "user_option"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.users.services.user_option.impl import DatabaseBackedUserOptionService

        return DatabaseBackedUserOptionService()

    @rpc_method
    @abstractmethod
    def serialize_many(
        self,
        *,
        filter: UserOptionFilterArgs,
        as_user: RpcUser | None = None,
        auth_context: AuthenticationContext | None = None,
    ) -> list[OpaqueSerializedResponse]:
        pass

    @rpc_method
    @abstractmethod
    def get_many(self, *, filter: UserOptionFilterArgs) -> list[RpcUserOption]:
        pass

    @rpc_method
    @abstractmethod
    def delete_options(self, *, option_ids: list[int]) -> None:
        pass

    @rpc_method
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


user_option_service = UserOptionService.create_delegation()
