import uuid
from collections.abc import Callable
from datetime import timedelta
from decimal import Decimal
from functools import partial
from typing import Any, ParamSpec, TypeVar

from django.core.cache import cache
from django.db import models
from django.db.models.signals import post_delete, post_save

from sentry.utils.hashlib import md5_text

P = ParamSpec("P")
R = TypeVar("R")
S = TypeVar("S", bound=models.Model)


def arg_to_hashable(arg: Any):
    if isinstance(arg, (int, float, str, Decimal, uuid.UUID)):
        return arg
    elif isinstance(arg, models.Model):
        return f"{arg._meta.label}:{arg.pk}"
    else:
        raise ValueError(
            "Can only cache functions whose parameters can be hashed in a consistent way"
        )


def cache_key_for_cached_func(cached_func: Callable[P, R], *args):
    base_cache_key = f"query_cache:{md5_text(cached_func.__qualname__).hexdigest()}"
    vals_to_hash = [arg_to_hashable(arg) for arg in args]
    return f"{base_cache_key}:{md5_text(*vals_to_hash).hexdigest()}"


def clear_cache_for_cached_func(
    cached_func: Callable[P, R], arg_getter, recalculate: bool, instance: S, *args, **kwargs
):
    args = arg_getter(instance)
    cache_key = cache_key_for_cached_func(cached_func, *args)
    if recalculate:
        cache.set(cache_key, cached_func(*args))
    else:
        cache.delete(cache_key)


def cache_func_for_models(
    cache_invalidators: list[tuple[type[S], Callable[[S], P.args]]],
    cache_ttl: None | timedelta = None,
    recalculate: bool = True,
):
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

    def cached_query_func(func_to_cache: Callable[P, R]):
        def inner(*args: P.args, **kwargs: P.kwargs) -> R:
            if kwargs:
                raise ValueError("Can't cache values using kwargs")

            cache_key = cache_key_for_cached_func(func_to_cache, *args)
            cached_val = cache.get(cache_key, None)
            if cached_val is None:
                cached_val = func_to_cache(*args)
                cache.set(cache_key, cached_val, timeout=cache_ttl.total_seconds())
            return cached_val

        for model, arg_getter in cache_invalidators:
            clear_cache_callable = partial(
                clear_cache_for_cached_func, func_to_cache, arg_getter, recalculate
            )
            post_save.connect(clear_cache_callable, sender=model, weak=False)
            post_delete.connect(clear_cache_callable, sender=model, weak=False)

        return inner

    return cached_query_func
