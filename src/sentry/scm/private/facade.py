from __future__ import annotations

from functools import lru_cache
from typing import Any, Callable, cast

from sentry.scm.private.helpers import exec_provider_fn
from sentry.scm.private.ipc import record_count_metric
from sentry.scm.private.provider import ALL_PROTOCOLS, Provider
from sentry.scm.types import Referrer


def _delegating_method(name: str) -> Callable[..., Any]:
    """Return a method that forwards calls to self.provider.<name>."""

    def method(self: Facade, *args: Any, **kwargs: Any) -> Any:
        return exec_provider_fn(
            self.provider,
            referrer=self.referrer,
            provider_fn=lambda: getattr(self.provider, name)(*args, **kwargs),
            record_count=self.record_count,
        )

    method.__name__ = name
    return method


@lru_cache(maxsize=32)
def _facade_type_for_provider_class(provider_cls: type[Provider]) -> type[Facade]:
    """Build (and cache) one facade subclass per implementation class."""
    methods: dict[str, Any] = {}
    for proto in ALL_PROTOCOLS:
        if all(hasattr(provider_cls, attr) for attr in proto.__protocol_attrs__):
            for attr in proto.__protocol_attrs__:
                if attr not in methods:
                    methods[attr] = _delegating_method(attr)
    return type(f"FacadeFor{provider_cls.__name__}", (Facade,), methods)


class Facade:
    # `Facade` itself declares no capability methods, so MyPy rejects direct
    # calls like `facade.do_alpha_1()` and forces `isinstance` guards.
    #
    # At construction time __new__ builds a private subclass that has exactly
    # the methods supported by `impl` as real class-body attributes.  Python
    # 3.12+ runtime_checkable isinstance() checks look at the class body, not
    # __getattr__, so this is what makes `isinstance(facade, CanAlpha)` work.
    #
    # After the isinstance guard MyPy narrows `facade` to `Facade & CanAlpha`
    # (or any other intersection) and statically validates method calls.

    def __new__(
        cls,
        provider: Provider,
        *,
        referrer: Referrer = "shared",
        record_count: Callable[[str, int, dict[str, str]], None] = record_count_metric,
    ) -> Facade:
        facade_cls = _facade_type_for_provider_class(cast(Any, type(provider)))
        instance = object.__new__(facade_cls)
        instance.provider = provider
        instance.referrer = referrer
        instance.record_count = record_count
        return instance

    def __init__(
        self,
        provider: Provider,
        *,
        referrer: Referrer = "shared",
        record_count: Callable[[str, int, dict[str, str]], None] = record_count_metric,
    ) -> None:
        pass
