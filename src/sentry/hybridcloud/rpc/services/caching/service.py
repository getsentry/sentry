# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
import abc
from typing import (
    TYPE_CHECKING,
    Callable,
    Generator,
    Generic,
    List,
    Mapping,
    Sequence,
    Type,
    TypeVar,
    Union,
)

import pydantic

from sentry.services.hybrid_cloud.region import ByRegionName
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method, rpc_method
from sentry.silo import SiloMode
from sentry.utils import json
from sentry.utils.json import JSONDecodeError

if TYPE_CHECKING:
    pass


class RegionCachingService(RpcService):
    key = "region_caching"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from .impl import LocalRegionCachingService

        return LocalRegionCachingService()

    @regional_rpc_method(resolve=ByRegionName())
    @abc.abstractmethod
    def clear_key(self, *, region_name: str, key: str) -> int:
        pass


_R = TypeVar("_R", bound=pydantic.BaseModel)


class SiloCacheBackedCallable(Generic[_R]):
    silo_mode: SiloMode
    base_key: str
    cb: Callable[[int], _R]
    type: Type[_R]

    def __init__(self, base_key: str, silo_mode: SiloMode, cb: Callable[[int], _R], t: Type[_R]):
        self.base_key = base_key
        self.silo_mode = silo_mode
        self.cb = cb
        self.type = t

    def __call__(self, args: int) -> _R:
        if (
            SiloMode.get_current_mode() != self.silo_mode
            and SiloMode.get_current_mode() != SiloMode.MONOLITH
        ):
            return self.cb(args)
        return self.get_many([args])[0]

    def key_from(self, args: int) -> str:
        return f"{self.base_key}:{args}"

    def resolve_from(
        self, i: int, values: Mapping[str, Union[int, str]]
    ) -> Generator[None, None, _R]:
        from .impl import _consume_generator, _delete_cache, _set_cache

        key = self.key_from(i)
        value = values[key]
        version: int
        if isinstance(value, str):
            try:
                return self.type(**json.loads(value))
            except (pydantic.ValidationError, JSONDecodeError, TypeError):
                version = yield from _delete_cache(key, self.silo_mode)
        else:
            version = value

        r = self.cb(i)
        _consume_generator(_set_cache(key, r.json(), version))
        return r

    def get_many(self, ids: Sequence[int]) -> List[_R]:
        from .impl import _consume_generator, _get_cache

        keys = [self.key_from(i) for i in ids]
        values = _consume_generator(_get_cache(keys, self.silo_mode))
        return [_consume_generator(self.resolve_from(i, values)) for i in ids]


def back_with_silo_cache(
    base_key: str, silo_mode: SiloMode, t: Type[_R]
) -> Callable[[Callable[[int], _R]], "SiloCacheBackedCallable[_R]"]:
    def wrapper(cb: Callable[[int], _R]) -> "SiloCacheBackedCallable[_R]":
        return SiloCacheBackedCallable(base_key, silo_mode, cb, t)

    return wrapper


region_caching_service = RegionCachingService.create_delegation()


class ControlCachingService(RpcService):
    key = "control_caching"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from .impl import LocalControlCachingService

        return LocalControlCachingService()

    @rpc_method
    @abc.abstractmethod
    def clear_key(self, *, key: str) -> int:
        pass


control_caching_service = ControlCachingService.create_delegation()
