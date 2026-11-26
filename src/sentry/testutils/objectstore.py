from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Any

from sentry.testutils.skips import requires_objectstore


def debug_files_test_both_backends[T: type](cls: T) -> T:
    return _test_both_backends(cls, "organizations:objectstore-debugfiles-exclusive-write")


def artifact_bundles_test_both_backends[T: type](cls: T) -> T:
    return _test_both_backends(cls, "organizations:objectstore-artifact-bundles-exclusive-write")


def _test_both_backends[T: type](cls: T, feature: str) -> T:
    if not isinstance(cls, type):
        raise TypeError("The storage backend decorator can only be applied to classes")

    for attr_name in list(vars(cls)):
        if attr_name.startswith("test_") and callable(getattr(cls, attr_name)):
            method = getattr(cls, attr_name)
            setattr(cls, attr_name, _wrap_test(method, feature, False))
            setattr(cls, f"{attr_name}_objectstore", _wrap_test(method, feature, True))
    return requires_objectstore(cls)


def _wrap_test(func: Callable[..., Any], feature: str, enabled: bool) -> Callable[..., Any]:
    @wraps(func)
    def wrapper(self: Any, *args: Any, **kwargs: Any) -> None:
        from sentry.testutils.helpers.features import Feature

        with Feature({feature: enabled}):
            func(self, *args, **kwargs)

    wrapper._snapshot_name = func.__name__  # type: ignore[attr-defined]
    return wrapper
