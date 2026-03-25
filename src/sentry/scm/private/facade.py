from __future__ import annotations

from collections.abc import Hashable
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


def _protocol_attrs(proto: object) -> tuple[str, ...]:
    """Return the runtime protocol attribute names used for capability detection."""
    return cast(tuple[str, ...], getattr(proto, "__protocol_attrs__", ()))


@lru_cache(maxsize=32)
def _facade_type_for_provider_class(
    cls: type[Facade], provider_cls: type[Provider]
) -> type[Facade]:
    """Build (and cache) one facade subclass per implementation class."""
    methods: dict[str, Any] = {}
    for proto in ALL_PROTOCOLS:
        protocol_attrs = _protocol_attrs(proto)
        if all(hasattr(provider_cls, attr) for attr in protocol_attrs):
            for attr in protocol_attrs:
                if attr not in methods:
                    methods[attr] = _delegating_method(attr)
    return type(f"FacadeFor{provider_cls.__name__}", (cls,), methods)


class Facade:
    # `Facade` itself declares no capability methods, so MyPy rejects direct
    # calls like `facade.create_issue_comment()` and forces `isinstance` guards.
    #
    # At construction time __new__ builds a private subclass that has exactly
    # the methods supported by `impl` as real class-body attributes.  Python
    # 3.12+ runtime_checkable isinstance() checks look at the class body, not
    # __getattr__, so this is what makes `isinstance(facade, protocol)` work.
    #
    # After the isinstance guard MyPy narrows `facade` to `Facade & Protocol`
    # and statically validates method calls.

    provider: Provider
    referrer: Referrer
    record_count: Callable[[str, int, dict[str, str]], None]

    def __new__(
        cls,
        provider: Provider,
        *,
        referrer: Referrer = "shared",
        record_count: Callable[[str, int, dict[str, str]], None] = record_count_metric,
    ) -> Facade:
        facade_cls = _facade_type_for_provider_class(
            cast(Hashable, cls), cast(Hashable, type(provider))
        )
        return object.__new__(facade_cls)

    def __init__(
        self,
        provider: Provider,
        *,
        referrer: Referrer = "shared",
        record_count: Callable[[str, int, dict[str, str]], None] = record_count_metric,
    ) -> None:
        self.provider = provider
        self.referrer = referrer
        self.record_count = record_count
