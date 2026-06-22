from __future__ import annotations

from functools import wraps

from sentry.testutils.skips import requires_objectstore

_FEATURE_FLAG = "organizations:objectstore-debugfiles-write"

_BACKENDS = [
    ("filestore", False),
    ("objectstore", True),
]


def debug_files_test_both_backends(cls):
    if not isinstance(cls, type):
        raise TypeError("debug_files_test_both_backends can only be applied to classes")

    for attr_name in list(vars(cls)):
        if attr_name.startswith("test_") and callable(getattr(cls, attr_name)):
            method = getattr(cls, attr_name)
            setattr(cls, attr_name, _wrap_test(method, False))
            setattr(cls, f"{attr_name}_objectstore", _wrap_test(method, True))
    return requires_objectstore(cls)


def _wrap_test(func, enabled):
    @wraps(func)
    def wrapper(self, *args, **kwargs):
        from sentry.testutils.helpers.features import Feature

        with Feature({_FEATURE_FLAG: enabled}):
            func(self, *args, **kwargs)

    return wrapper
