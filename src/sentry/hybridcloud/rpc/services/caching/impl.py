from typing import Dict, Generator, List, Mapping, Type, TypeVar, Union

from django.core.cache import cache

from sentry.hybridcloud.models.cacheversion import CacheVersionBase, RegionCacheVersion
from sentry.hybridcloud.rpc.services.caching import ControlCachingService, RegionCachingService
from sentry.silo import SiloMode

_V = TypeVar("_V")

# Implementation uses generators so that testing concurrent read after writer properties is much easier.
# In practice all generators are synchronously consumed, except for tests.


def _consume_generator(g: Generator[None, None, _V]) -> _V:
    while True:
        try:
            g.send(None)
        except StopIteration as e:
            return e.value


def _set_cache(key: str, value: str, version: int) -> Generator[None, None, bool]:
    result = cache.add(_versioned_key(key, version), value)
    yield
    return result


def _versioned_key(key: str, version: int) -> str:
    return f"{key}.{version}"


def _version_model(mode: SiloMode) -> Type[CacheVersionBase]:
    if mode == SiloMode.REGION:
        return RegionCacheVersion
    raise ValueError


def _delete_cache(key: str, mode: SiloMode) -> Generator[None, None, int]:
    version = _version_model(mode).incr_version(key)
    yield
    return version


def _get_cache(
    keys: List[str], mode: SiloMode
) -> Generator[None, None, Mapping[str, Union[str, int]]]:
    versions = {cv.key: cv.version for cv in _version_model(mode).objects.filter(key__in=keys)}
    yield

    versioned_keys = [_versioned_key(key, versions.get(key, 0)) for key in keys]
    existing = cache.get_many(versioned_keys)
    yield
    result: Dict[str, Union[str, int]] = {}
    for k, versioned_key in zip(keys, versioned_keys):
        if versioned_key in existing:
            result[k] = existing[versioned_key]
            continue
        result[k] = versions.get(k, 0)
    return result


class CacheBackend:
    """
    'Exposes' the underlying caching and its versioning system so that tests can fully validate the
    concurrent consistency of the implementation.  Not intended as a public interface.
    """

    get_cache = staticmethod(_get_cache)
    delete_cache = staticmethod(_delete_cache)
    set_cache = staticmethod(_set_cache)


class LocalRegionCachingService(RegionCachingService):
    def clear_key(self, *, region_name: str, key: str) -> int:
        return _consume_generator(_delete_cache(key, SiloMode.REGION))


class LocalControlCachingService(ControlCachingService):
    def clear_key(self, *, key: str) -> int:
        return _consume_generator(_delete_cache(key, SiloMode.CONTROL))
