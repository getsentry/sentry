from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Any

from sentry.testutils.skips import requires_objectstore


def debug_files_test_both_backends[T: type](cls: T) -> T:
    if not isinstance(cls, type):
        raise TypeError("debug_files_test_both_backends can only be applied to classes")

    for attr_name in list(vars(cls)):
        if attr_name.startswith("test_") and callable(getattr(cls, attr_name)):
            method = getattr(cls, attr_name)
            setattr(cls, attr_name, _wrap_test(method, False))
            setattr(cls, f"{attr_name}_objectstore", _wrap_test(method, True))
    return requires_objectstore(cls)


def _wrap_test(func: Callable[..., Any], enabled: bool) -> Callable[..., Any]:
    @wraps(func)
    def wrapper(self: Any, *args: Any, **kwargs: Any) -> None:
        from sentry.testutils.helpers.features import Feature

        with Feature(
            {
                "organizations:objectstore-debugfiles-write": enabled,
                "organizations:objectstore-debugfiles-read": enabled,
                "organizations:objectstore-debugfiles-direct-read": enabled,
            }
        ):
            func(self, *args, **kwargs)

    wrapper._snapshot_name = func.__name__  # type: ignore[attr-defined]
    return wrapper
