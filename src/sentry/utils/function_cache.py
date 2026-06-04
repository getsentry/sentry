from __future__ import annotations

import logging
import uuid
from collections.abc import Callable, Sequence
from datetime import timedelta
from decimal import Decimal
from functools import partial, update_wrapper
from typing import Generic, TypeVar, TypeVarTuple

from django.core.cache import cache
from django.db import models
from django.db.models.signals import post_delete, post_save

from sentry.utils.hashlib import md5_text

logger = logging.getLogger(__name__)
Ts = TypeVarTuple("Ts")
R = TypeVar("R")
S = TypeVar("S", bound=models.Model)

_NONE_HASHABLE = "DD47DB9F-6165-42E1-A719-D0CF702E1788"


def arg_to_hashable(arg: object) -> object:
    if isinstance(arg, (int, float, str, Decimal, uuid.UUID)):
        return arg
    elif isinstance(arg, models.Model):
        return f"{arg._meta.label}:{arg.pk}"
    elif arg is None:
        return _NONE_HASHABLE  # won't change across runs/interpreter versions
    else:
        raise ValueError(
            "Can only cache functions whose parameters can be hashed in a consistent way"
        )


def cache_key_for_cached_func(cached_func: Callable[[*Ts], R], *args: *Ts) -> str:
    base_cache_key = f"query_cache:{md5_text(cached_func.__qualname__).hexdigest()}"
    vals_to_hash = [arg_to_hashable(arg) for arg in args]
    return f"{base_cache_key}:{md5_text(*vals_to_hash).hexdigest()}"


def clear_cache_for_cached_func(
    cached_func: Callable[[*Ts], R],
    arg_getter: Callable[[S], tuple[*Ts]],
    recalculate: bool,
    instance: S,
    *args: object,
    **kwargs: object,
) -> None:
    func_args = arg_getter(instance)
    cache_key = cache_key_for_cached_func(cached_func, *func_args)
    if recalculate:
        try:
            value = cached_func(*func_args)
        except Exception:
            logger.exception("Failed to recalculate cached value")
            cache.delete(cache_key)
        else:
            cache.set(cache_key, value)
    else:
        cache.delete(cache_key)


def cache_func_for_models(
    cache_invalidators: list[tuple[type[S], Callable[[S], tuple[*Ts]]]],
    cache_ttl: None | timedelta = None,
    recalculate: bool = True,
) -> Callable[[Callable[[*Ts], R]], CachedFunction[*Ts, R]]:
    """
    Decorator that caches the result of a function, and actively invalidates the result when related models are
    created/updated/deleted. To use this, decorate a function with this decorator and pass a list of `cache_invalidators`
    that tell us how to invalidate the cache.
    Each entry in `cache_invalidators` is a tuple of (<Model>, <func>). In more detail:
     - Model is the model we'll listen to for updates. When this model fires a `post_save` or `post_delete` signal
       we'll invalidate the cache.
     - Func is a function that accepts an instance of `Model` and returns a tuple of values that can be used to call
       the cached function. These values are used to invalidate the cache.

    This only works with functions that are called using args.

    If `recalculate` is `True`, we'll re-run the decorated function and overwrite the cached value. If `False`, we'll
    just remove the value from the cache.

    The decorated function is replaced with a CachedFunction instance that provides both the original
    function behavior and a batch method for efficient bulk operations.
    """
    if cache_ttl is None:
        cache_ttl = timedelta(days=7)

    def cached_query_func(func_to_cache: Callable[[*Ts], R]) -> CachedFunction[*Ts, R]:
        for model, arg_getter in cache_invalidators:
            clear_cache_callable = partial(
                clear_cache_for_cached_func, func_to_cache, arg_getter, recalculate
            )
            post_save.connect(clear_cache_callable, sender=model, weak=False)
            post_delete.connect(clear_cache_callable, sender=model, weak=False)

        return CachedFunction(func_to_cache, cache_ttl)

    return cached_query_func


def cache_func(
    cache_ttl: None | timedelta = None,
) -> Callable[[Callable[[*Ts], R]], CachedFunction[*Ts, R]]:
    if cache_ttl is None:
        cache_ttl = timedelta(days=7)

    def cached_query_func(func_to_cache: Callable[[*Ts], R]) -> CachedFunction[*Ts, R]:
        return CachedFunction(func_to_cache, cache_ttl)

    return cached_query_func


class CachedFunction(Generic[*Ts, R]):
    """
    A callable class that wraps a function with caching capabilities and provides a batch method
    for processing multiple sets of arguments efficiently.
    """

    def __init__(self, func: Callable[[*Ts], R], cache_ttl: timedelta):
        self.func = func
        self.cache_ttl = cache_ttl
        update_wrapper(self, func)

    def __call__(self, *args: *Ts) -> R:
        cache_key = cache_key_for_cached_func(self.func, *args)
        cached_val = cache.get(cache_key, None)
        if cached_val is None:
            cached_val = self.func(*args)
            cache.set(cache_key, cached_val, timeout=self.cache_ttl.total_seconds())
        return cached_val

    def batch(self, args_list: Sequence[tuple[*Ts]]) -> list[R]:
        cache_keys = [cache_key_for_cached_func(self.func, *args) for args in args_list]
        values = cache.get_many(cache_keys)

        missing_keys = {ck: args for ck, args in zip(cache_keys, args_list) if ck not in values}

        to_cache = {}
        for cache_key, args in missing_keys.items():
            result = self.func(*args)
            values[cache_key] = result
            to_cache[cache_key] = result

        if to_cache:
            cache.set_many(to_cache, timeout=self.cache_ttl.total_seconds())

        return [values[ck] for ck in cache_keys]
