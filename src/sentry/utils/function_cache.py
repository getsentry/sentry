from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from datetime import timedelta
from decimal import Decimal
from functools import partial
from typing import TypeVar, TypeVarTuple

from django.core.cache import cache
from django.db import models
from django.db.models.signals import post_delete, post_save

from sentry.utils.hashlib import md5_text

logger = logging.getLogger(__name__)
Ts = TypeVarTuple("Ts")
R = TypeVar("R")
S = TypeVar("S", bound=models.Model)
Key = TypeVar("Key")

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
            f"Can only cache functions whose parameters can be hashed in a consistent way: {arg}"
        )


def cache_key_for_batched_func[Key, R](cached_func: Callable[[list[Key]], list[R]], k: Key) -> str:
    base_cache_key = f"query_cache:{md5_text(cached_func.__qualname__).hexdigest()}"
    val_to_hash = arg_to_hashable(k)
    return f"{base_cache_key}:{md5_text(val_to_hash).hexdigest()}"


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
) -> Callable[[Callable[[*Ts], R]], Callable[[*Ts], R]]:
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
    """
    if cache_ttl is None:
        cache_ttl = timedelta(days=7)

    def cached_query_func(func_to_cache: Callable[[*Ts], R]) -> Callable[[*Ts], R]:
        for model, arg_getter in cache_invalidators:
            clear_cache_callable = partial(
                clear_cache_for_cached_func, func_to_cache, arg_getter, recalculate
            )
            post_save.connect(clear_cache_callable, sender=model, weak=False)
            post_delete.connect(clear_cache_callable, sender=model, weak=False)

        return build_inner_cache_func(func_to_cache, cache_ttl)

    return cached_query_func


def batch_cache_func_for_models(
    cache_invalidators: list[tuple[type[S], Callable[[S], Key]]],
    cache_ttl: timedelta | None = None,
    recalculate: bool = True,
) -> Callable[[Callable[[list[Key]], list[R]]], Callable[[list[Key]], list[R]]]:
    """
    Decorator that caches the result of a batched function, and actively invalidates the result when related models are
    created/updated/deleted. This is a batched variant of cache_func_for_models that works with functions that take
    and return lists of values.

    To use this, decorate a function with this decorator and pass a list of `cache_invalidators` that tell us how to
    invalidate the cache. Each entry in `cache_invalidators` is a tuple of (<Model>, <func>). In more detail:
     - Model is the model we'll listen to for updates. When this model fires a `post_save` or `post_delete` signal
       we'll invalidate the cache.
     - Func is a function that accepts an instance of `Model` and returns a value that can be used to call
       the cached function. These values are used to invalidate the cache.

    The wrapped function must return a list where each index contains the result for the key at that same index,
    and must return a result for every key in the input list.

    If `recalculate` is `True`, we'll re-run the decorated function and overwrite the cached value. If `False`, we'll
    just remove the value from the cache.
    """
    if cache_ttl is None:
        cache_ttl = timedelta(days=7)

    def builder(fn: Callable[[list[Key]], list[R]]) -> Callable[[list[Key]], list[R]]:
        cached_fn = build_batched_cache_func(fn, cache_ttl)

        for model, arg_getter in cache_invalidators:

            def clear_cache(instance: S, **kwargs: object) -> None:
                cache_key = cache_key_for_batched_func(fn, arg_getter(instance))
                if recalculate:
                    try:
                        value = fn([arg_getter(instance)])
                        if len(value) != 1:
                            raise ValueError(
                                f"Function {fn.__qualname__} returned {len(value)} results for 1 key"
                            )
                    except Exception:
                        logger.exception("Failed to recalculate cached value")
                        cache.delete(cache_key)
                    else:
                        cache.set(cache_key, value[0], timeout=cache_ttl.total_seconds())
                else:
                    cache.delete(cache_key)

            post_save.connect(clear_cache, sender=model, weak=False)
            post_delete.connect(clear_cache, sender=model, weak=False)

        return cached_fn

    return builder


def cache_func(
    cache_ttl: None | timedelta = None,
) -> Callable[[Callable[[*Ts], R]], Callable[[*Ts], R]]:
    if cache_ttl is None:
        cache_ttl = timedelta(days=7)

    def cached_query_func(func_to_cache: Callable[[*Ts], R]) -> Callable[[*Ts], R]:
        return build_inner_cache_func(func_to_cache, cache_ttl)

    return cached_query_func


def build_inner_cache_func(
    func_to_cache: Callable[[*Ts], R], cache_ttl: timedelta
) -> Callable[[*Ts], R]:
    def inner(*args: *Ts) -> R:
        cache_key = cache_key_for_cached_func(func_to_cache, *args)
        cached_val = cache.get(cache_key, None)
        if cached_val is None:
            cached_val = func_to_cache(*args)
            cache.set(cache_key, cached_val, timeout=cache_ttl.total_seconds())
        return cached_val

    return inner


def build_batched_cache_func[
    Key, R
](func_to_cache: Callable[[list[Key]], list[R]], cache_ttl: timedelta) -> Callable[
    [list[Key]], list[R]
]:
    """
    Builds a function that caches the results of a batched function. The function will:
    1. Check the cache for each key in the input list
    2. For any keys not in cache, call the original function with just those keys
    3. Store the results in cache
    4. Return a list of results in the same order as the input keys
    """

    def inner(args: list[Key]) -> list[R]:
        cache_keys = [cache_key_for_batched_func(func_to_cache, arg) for arg in args]
        values = cache.get_many(cache_keys)
        missing_keys = [key for key in cache_keys if key not in values]
        if missing_keys:
            key_to_arg = {key: arg for arg, key in zip(args, cache_keys)}
            missing_args = [key_to_arg[key] for key in missing_keys]
            missing_vals = func_to_cache(missing_args)
            if len(missing_vals) != len(missing_args):
                raise ValueError(
                    f"Function {func_to_cache.__qualname__} returned {len(missing_vals)} results for {len(missing_keys)} keys"
                )
            fetched = dict(zip(missing_keys, missing_vals))
            cache.set_many(fetched, timeout=cache_ttl.total_seconds())
            values.update(fetched)
        return [values[key] for key in cache_keys]

    return inner
