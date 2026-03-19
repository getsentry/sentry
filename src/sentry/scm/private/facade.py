from __future__ import annotations

import typing
from functools import lru_cache

from sentry.scm.private.provider import ALL_PROTOCOLS


def _delegating_method(name: str) -> typing.Callable[..., typing.Any]:
    """Return a method that forwards calls to self._impl.<name>."""

    def method(self: Facade, *args: typing.Any, **kwargs: typing.Any) -> typing.Any:
        return getattr(self._impl, name)(*args, **kwargs)

    method.__name__ = name
    return method


@lru_cache(maxsize=32)
def _facade_type_for_impl_class(impl_cls: type[object]) -> type[Facade]:
    """Build (and cache) one facade subclass per implementation class."""
    methods: dict[str, typing.Any] = {}
    for proto in ALL_PROTOCOLS:
        if all(hasattr(impl_cls, attr) for attr in proto.__protocol_attrs__):
            for attr in proto.__protocol_attrs__:
                if attr not in methods:
                    methods[attr] = _delegating_method(attr)
    return type(f"FacadeFor{impl_cls.__name__}", (Facade,), methods)


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

    def __new__(cls, impl: object) -> Facade:
        facade_cls = _facade_type_for_impl_class(typing.cast(typing.Any, type(impl)))
        return object.__new__(facade_cls)

    def __init__(self, impl: object) -> None:
        self._impl = impl
