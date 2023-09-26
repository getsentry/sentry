# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
import abc
from typing import (
    Callable,
    Collection,
    Dict,
    FrozenSet,
    Generator,
    Generic,
    List,
    Mapping,
    Sequence,
    Type,
    TypeVar,
    Union,
    cast,
)

import pydantic
from django.core.cache import cache

from sentry.services.hybrid_cloud.region import ByRegionName
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method, rpc_method
from sentry.silo import SiloMode
from sentry.utils import json
from sentry.utils.json import JSONDecodeError


class RegionCachingService(RpcService):
    key = "region_caching"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        return LocalRegionCachingService()

    @regional_rpc_method(resolve=ByRegionName())
    @abc.abstractmethod
    def clear_key(self, *, region_name: str, key: str) -> int:
        pass


class ControlCachingService(RpcService):
    key = "control_caching"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        return LocalControlCachingService()

    @rpc_method
    @abc.abstractmethod
    def clear_key(self, *, key: str) -> int:
        pass


def _set_cache(key: str, value: str, version: int) -> Generator[None, None, bool]:
    result = cache.add(_versioned_key(key, version), value)
    # cache.set(_versioned_key(key, version), value)
    yield
    return result


def _version_key(key: str) -> str:
    return f"{key}.v"


def _versioned_key(key: str, version: int) -> str:
    return f"{key}.{version}"


def _delete_cache(key: str) -> Generator[None, None, int]:
    try:
        version = cache.incr(_version_key(key))
        yield
    except ValueError:
        version = 0
        cache.add(_version_key(key), version)
        yield
    # Ensure vacancy
    cache.delete(_versioned_key(key, version))
    yield
    return version


def _get_cache(keys: List[str]) -> Generator[None, None, Mapping[str, Union[str, int]]]:
    version_keys = [_version_key(k) for k in keys]
    versions = cache.get_many(version_keys)
    yield
    versioned_keys = [
        _versioned_key(key, int(versions.get(version_key, "0")))
        for key, version_key in zip(keys, version_keys)
    ]
    existing = cache.get_many(versioned_keys)
    yield
    result: Dict[str, Union[str, int]] = {}
    for k, version_key, versioned_key in zip(keys, version_keys, versioned_keys):
        if versioned_key in existing:
            result[k] = existing[versioned_key]
            continue
        result[k] = versions.get(version_key, 0)
    return result


class CacheBackend:
    """
    'Exposes' the underlying caching and its versioning system so that tests can fully validate the
    concurrent consistency of the implementation.  Not intended as a public interface.
    """

    get_cache = staticmethod(_get_cache)
    delete_cache = staticmethod(_delete_cache)
    set_cache = staticmethod(_set_cache)


_V = TypeVar("_V")


def _consume_generator(g: Generator[None, None, _V]) -> _V:
    while True:
        try:
            g.send(None)
        except StopIteration as e:
            return e.value


class LocalRegionCachingService(RegionCachingService):
    def clear_key(self, *, region_name: str, key: str) -> int:
        return _consume_generator(_delete_cache(key))


class LocalControlCachingService(ControlCachingService):
    def clear_key(self, *, key: str) -> int:
        return _consume_generator(_delete_cache(key))


_R = TypeVar("_R", bound=pydantic.BaseModel)


class SiloCacheBackedCallable(Generic[_R]):
    silo_modes: FrozenSet[SiloMode]
    base_key: str
    cb: Callable[[int], _R]
    type: Type[_R]

    def __init__(
        self, base_key: str, silo_modes: Collection[SiloMode], cb: Callable[[int], _R], t: Type[_R]
    ):
        self.base_key = base_key
        self.silo_modes = frozenset(silo_modes)
        self.cb = cb
        self.type = t

    def __call__(self, args: int) -> _R:
        if SiloMode.get_current_mode() not in self.silo_modes:
            return self.cb(args)
        return self.get_many([args])[0]

    def key_from(self, args: int) -> str:
        return f"{self.base_key}:{args}"

    def resolve_from(
        self, i: int, values: Mapping[str, Union[int, str]]
    ) -> Generator[None, None, _R]:
        key = self.key_from(i)
        value = values[key]
        version: int
        if isinstance(value, str):
            try:
                return self.type(**json.loads(value))
            except (pydantic.ValidationError, JSONDecodeError, TypeError):
                version = yield from _delete_cache(key)
        else:
            version = value

        r = self.cb(i)
        _set_cache(key, r.json(), version)
        return r

    def get_many(self, ids: Sequence[int]) -> List[_R]:
        keys = [self.key_from(i) for i in ids]
        values = _consume_generator(_get_cache(keys))
        return [_consume_generator(self.resolve_from(i, values)) for i in ids]


def back_with_silo_cache(
    base_key: str, silo_modes: Collection[SiloMode], t: Type[_R]
) -> Callable[[Callable[[int], _R]], SiloCacheBackedCallable[_R]]:
    def wrapper(cb: Callable[[int], _R]) -> SiloCacheBackedCallable[_R]:
        return SiloCacheBackedCallable(base_key, silo_modes, cb, t)

    return wrapper


region_caching_service = cast(RegionCachingService, RegionCachingService.create_delegation())
control_caching_service = cast(ControlCachingService, ControlCachingService.create_delegation())
