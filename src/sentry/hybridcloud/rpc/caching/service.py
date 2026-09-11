# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
import abc
import hashlib
import re
from collections.abc import Callable, Generator, Mapping
from typing import TYPE_CHECKING, Generic, TypeVar, TypeVarTuple

import pydantic

from sentry.hybridcloud.rpc.resolvers import ByCellName
from sentry.hybridcloud.rpc.service import RpcService, cell_rpc_method, rpc_method
from sentry.silo.base import SiloMode
from sentry.utils import json, metrics
from sentry.utils.json import JSONDecodeError

if TYPE_CHECKING:
    pass


class CellCachingService(RpcService):
    key = "region_caching"
    local_mode = SiloMode.CELL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from .impl import LocalCellCachingService

        return LocalCellCachingService()

    @cell_rpc_method(resolve=ByCellName())
    @abc.abstractmethod
    def clear_key(
        self,
        *,
        cell_name: str,
        key: str,
    ) -> int:
        pass


_R = TypeVar("_R", bound=pydantic.BaseModel)
_Params = TypeVarTuple("_Params")

# Cache keys are stored in ``CacheVersionBase.key``, a varchar(64). Keys longer than
# this raise a DataError when a version row is created during cache invalidation.
MAX_CACHE_KEY_LENGTH = 64

# We can go as low as 16 bytes of md5 without risking collisions
MAX_BASE_KEY_LENGTH = MAX_CACHE_KEY_LENGTH - 16

# Memcached rejects whitespace and control characters in keys, so any parameter
# encoding containing them has to be hashed rather than used verbatim.
_UNSAFE_KEY_CHARS = re.compile(r"[^\x21-\x7e]")


class SiloCacheBackedCallable(Generic[*_Params, _R]):
    """
    Get a single record from cache or wrapped function.

    When cache read returns no data, the wrapped function will be
    invoked. The result of the wrapped function is then stored in cache.

    Ideal for 'get by id' style methods.

    Cache keys vary based on the parameters, so all parameters must be JSON
    serializable. Parameters that don't fit in the remaining key budget, or that
    contain characters memcached rejects, are hashed instead.
    """

    silo_mode: SiloMode
    base_key: str
    cb: Callable[[*_Params], _R | None]
    type_: type[_R]
    timeout: int | None

    def __init__(
        self,
        base_key: str,
        silo_mode: SiloMode,
        cb: Callable[[*_Params], _R | None],
        t: type[_R],
        timeout: int | None = None,
    ):
        if len(base_key) > MAX_BASE_KEY_LENGTH:
            raise ValueError(
                f"base_key {base_key!r} is {len(base_key)} characters; it must be at most "
                f"{MAX_BASE_KEY_LENGTH} so that hashed parameters fit within the "
                f"{MAX_CACHE_KEY_LENGTH} character CacheVersion.key column"
            )
        self.base_key = base_key
        self.silo_mode = silo_mode
        self.cb = cb
        self.type_ = t
        self.timeout = timeout

    def __call__(self, *args: *_Params) -> _R | None:
        if (
            SiloMode.get_current_mode() != self.silo_mode
            and SiloMode.get_current_mode() != SiloMode.MONOLITH
        ):
            return self.cb(*args)
        return self.get_one(*args)

    def key_from(self, *args: *_Params) -> str:
        """
        Generate a cache key for this call.
        Keys must fit within CacheVersion.key column, and not contain whitespace.
        """
        # Preserve compatibility with historical cache keys
        if len(args) == 1:
            arg_str = str(args[0])  # type: ignore[misc]
        else:
            arg_str = json.dumps(args)

        # Replace parameters that would overflow the key column, or that memcached
        # would reject, with a digest of the same parameters. Add 1 for the :
        if len(arg_str) + len(self.base_key) + 1 > MAX_CACHE_KEY_LENGTH or _UNSAFE_KEY_CHARS.search(
            arg_str
        ):
            arg_str = hashlib.md5(arg_str.encode("utf-8")).hexdigest()

        return f"{self.base_key}:{arg_str}"[:MAX_CACHE_KEY_LENGTH]

    def resolve_from(
        self, values: Mapping[str, int | str], *args: *_Params
    ) -> Generator[None, None, _R | None]:
        from .impl import _consume_generator, _delete_cache, _set_cache

        key = self.key_from(*args)
        value = values[key]
        version: int
        if isinstance(value, str):
            try:
                metrics.incr("hybridcloud.caching.one.cached", tags={"base_key": self.base_key})
                return self.type_(**json.loads(value))
            except (pydantic.ValidationError, JSONDecodeError, TypeError):
                version = yield from _delete_cache(key, self.silo_mode)
        else:
            version = value

        metrics.incr("hybridcloud.caching.one.rpc", tags={"base_key": self.base_key})
        r = self.cb(*args)
        if r is not None:
            _consume_generator(_set_cache(key, r.json(), version, self.timeout))
        return r

    def get_one(self, *args: *_Params) -> _R | None:
        from .impl import _consume_generator, _get_cache

        key = self.key_from(*args)
        values = _consume_generator(_get_cache([key], self.silo_mode))
        return _consume_generator(self.resolve_from(values, *args))


class SiloCacheBackedListCallable(Generic[_R]):
    """
    Get a list of results from cache or wrapped function.

    When cache read returns no data, the wrapped function will be
    invoked. The result of the wrapped function is then stored in cache.

    Ideal for 'get many X for organization' style methods
    """

    silo_mode: SiloMode
    base_key: str
    cb: Callable[[int], list[_R]]
    type_: type[_R]
    timeout: int | None

    def __init__(
        self,
        base_key: str,
        silo_mode: SiloMode,
        cb: Callable[[int], list[_R]],
        t: type[_R],
        timeout: int | None = None,
    ):
        self.base_key = base_key
        self.silo_mode = silo_mode
        self.cb = cb
        self.type_ = t
        self.timeout = timeout

    def __call__(self, object_id: int) -> list[_R]:
        if (
            SiloMode.get_current_mode() != self.silo_mode
            and SiloMode.get_current_mode() != SiloMode.MONOLITH
        ):
            return self.cb(object_id)
        return self.get_results(object_id)

    def key_from(self, object_id: int) -> str:
        return f"{self.base_key}:{object_id}"

    def resolve_from(
        self, object_id: int, values: Mapping[str, int | str]
    ) -> Generator[None, None, list[_R]]:
        from .impl import _consume_generator, _delete_cache, _set_cache

        key = self.key_from(object_id)
        value = values[key]
        version: int
        if isinstance(value, str):
            try:
                metrics.incr("hybridcloud.caching.list.cached", tags={"base_key": self.base_key})
                return [self.type_(**item) for item in json.loads(value)]
            except (pydantic.ValidationError, JSONDecodeError, TypeError) as err:
                metrics.incr(
                    "hybridcloud.caching.list.failed_read",
                    tags={
                        "base_key": self.base_key,
                        "err": type(err).__name__,
                    },
                )
                version = yield from _delete_cache(key, self.silo_mode)
        else:
            version = value

        metrics.incr("hybridcloud.caching.list.rpc", tags={"base_key": self.base_key})
        result = self.cb(object_id)
        if result is not None:
            cache_value = json.dumps([item.dict() for item in result])
            _consume_generator(_set_cache(key, cache_value, version, self.timeout))
        return result

    def get_results(self, object_id: int) -> list[_R]:
        from .impl import _consume_generator, _get_cache

        key = self.key_from(object_id)
        values = _consume_generator(_get_cache([key], self.silo_mode))
        return _consume_generator(self.resolve_from(object_id, values))


class SiloCacheManyBackedCallable(Generic[_R]):
    """
    Get a multiple records from cache or wrapped function.

    When cache read returns no or partial data, the wrapped function will be invoked
    with keys missing data. The result of the wrapped function will then be stored in cache.

    Ideal for 'get many by id' style methods.
    """

    silo_mode: SiloMode
    base_key: str
    cb: Callable[[list[int]], list[_R]]
    type_: type[_R]
    timeout: int | None

    def __init__(
        self,
        base_key: str,
        silo_mode: SiloMode,
        cb: Callable[[list[int]], list[_R]],
        t: type[_R],
        timeout: int | None = None,
    ):
        self.base_key = base_key
        self.silo_mode = silo_mode
        self.cb = cb
        self.type_ = t
        self.timeout = timeout

    def __call__(self, ids: list[int]) -> list[_R]:
        if (
            SiloMode.get_current_mode() != self.silo_mode
            and SiloMode.get_current_mode() != SiloMode.MONOLITH
        ):
            return self.cb(ids)
        return self.get_many(ids)

    def key_from(self, object_id: int) -> str:
        return f"{self.base_key}:{object_id}"

    def get_many(self, ids: list[int]) -> list[_R]:
        from .impl import _consume_generator, _delete_cache, _get_cache, _set_cache

        keys = {i: self.key_from(i) for i in ids}
        cache_values = _consume_generator(_get_cache(list(keys.values()), self.silo_mode))

        # Mapping between object_id and cache versions
        missing: dict[int, int] = {}
        found: dict[int, _R] = {}

        for object_id, cache_key in keys.items():
            version: int | None = None
            cache_value = cache_values[cache_key]
            if isinstance(cache_value, str):
                # Found data in cache
                try:
                    found[object_id] = self.type_(**json.loads(cache_value))
                except (pydantic.ValidationError, JSONDecodeError, TypeError):
                    version = _consume_generator(_delete_cache(cache_key, self.silo_mode))
            else:
                # Data was missing in cache but we have a version for the cache key
                version = cache_value
            if version is not None:
                missing[object_id] = version

        missing_keys = list(missing.keys())
        metrics.incr(
            "hybridcloud.caching.many.rpc", len(missing_keys), tags={"base_key": self.base_key}
        )
        metrics.incr(
            "hybridcloud.caching.many.cached", len(found), tags={"base_key": self.base_key}
        )

        # This result could have different order than missing_object_ids, or have gaps
        cb_result = self.cb(missing_keys)
        for record in cb_result:
            # TODO(hybridcloud) The types/interfaces don't make reading this attribute safe.
            # We rely on a convention of records having `id` for now. In the future
            # this could become a decorator parameter instead.
            record_id = getattr(record, "id")
            if record_id is None:
                continue
            cache_key = keys[record_id]
            record_version = missing[record_id]
            _consume_generator(_set_cache(cache_key, record.json(), record_version, self.timeout))
            found[record_id] = record

        return [found[id] for id in ids if id in found]


def back_with_silo_cache(
    base_key: str, silo_mode: SiloMode, t: type[_R], timeout: int | None = None
) -> Callable[[Callable[[*_Params], _R | None]], "SiloCacheBackedCallable[*_Params, _R]"]:
    """
    Decorator for adding local caching to RPC operations on a single record.

    This decorator can be applied to RPC methods that fetch a single object.
    If the cache read fails, the decorated function will be called and its result
    will be stored in cache. The decorator adds helper methods on the wrapped
    function for generating keys to clear cache entries
    with cell_caching_service and control_caching_service.

    See user_service.get_user() for an example usage.
    """

    def wrapper(cb: Callable[[*_Params], _R | None]) -> "SiloCacheBackedCallable[*_Params, _R]":
        return SiloCacheBackedCallable(base_key, silo_mode, cb, t, timeout)

    return wrapper


def back_with_silo_cache_many(
    base_key: str, silo_mode: SiloMode, t: type[_R], timeout: int | None = None
) -> Callable[[Callable[[list[int]], list[_R]]], "SiloCacheManyBackedCallable[_R]"]:
    """
    Decorator for adding local caching to RPC operations that fetch many records by id.

    This decorator can be applied to RPC methods that fetch multiple objects.
    First all ids will be read from cache. Any records that were not available in cache
    will be forwarded to the wrapped method. The result of the wrapped method will be stored
    in cache for future use.

    Like `back_with_silo_cache`, this decorator adds helpers to the wrapped function
    for generating keys to clear cache.
    """

    def wrapper(cb: Callable[[list[int]], list[_R]]) -> "SiloCacheManyBackedCallable[_R]":
        return SiloCacheManyBackedCallable(base_key, silo_mode, cb, t, timeout)

    return wrapper


def back_with_silo_cache_list(
    base_key: str, silo_mode: SiloMode, t: type[_R], timeout: int | None = None
) -> Callable[[Callable[[int], list[_R]]], "SiloCacheBackedListCallable[_R]"]:
    """
    Decorator for adding local caching to RPC operations for list results

    This decorator can be applied to RPC methods that fetch a list of results
    based on a single input id. This works well with methods that get a list
    of results based on an organization or user id.

    If the cache read for the id value fails, the decorated function will be called and
    its result will be stored in cache. The decorator also adds method on the wrapped
    function for generating keys to clear cache entires with
    with cell_caching_service and control_caching_service.

    See app_service.installations_for_organization() for an example usage.
    """

    def wrapper(cb: Callable[[int], list[_R]]) -> "SiloCacheBackedListCallable[_R]":
        return SiloCacheBackedListCallable(base_key, silo_mode, cb, t, timeout)

    return wrapper


cell_caching_service = CellCachingService.create_delegation()


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
