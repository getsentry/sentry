from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Any

from sentry.testutils.skips import requires_objectstore


def debug_files_test_both_backends[T: type](cls: T) -> T:
    return _both_backends(cls, "organizations:objectstore-debugfiles-write")


def preprod_test_both_backends[T: type](cls: T) -> T:
    return _both_backends(cls, "organizations:objectstore-preprod-exclusive-write")


def _both_backends[T: type](cls: T, flag: str) -> T:
    if not isinstance(cls, type):
        raise TypeError("Backend decorators can only be applied to classes")

    for attr_name in list(vars(cls)):
        if attr_name.startswith("test_") and callable(getattr(cls, attr_name)):
            method = getattr(cls, attr_name)
            setattr(cls, attr_name, _wrap_test(method, flag, False))
            setattr(cls, f"{attr_name}_objectstore", _wrap_test(method, flag, True))
    return requires_objectstore(cls)


def _wrap_test(func: Callable[..., Any], flag: str, enabled: bool) -> Callable[..., Any]:
    @wraps(func)
    def wrapper(self: Any, *args: Any, **kwargs: Any) -> None:
        from sentry.testutils.helpers.features import Feature

        with Feature({flag: enabled}):
            func(self, *args, **kwargs)

    wrapper._snapshot_name = func.__name__  # type: ignore[attr-defined]
    return wrapper
