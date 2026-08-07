from __future__ import annotations

import sys
import types
from typing import Any


def register_scheme(name: str) -> None:
    from urllib import parse as urlparse

    uses = urlparse.uses_netloc, urlparse.uses_query, urlparse.uses_relative, urlparse.uses_fragment
    for use in uses:
        if name not in use:
            use.append(name)


register_scheme("app")
register_scheme("chrome-extension")


def _add_class_getitem(cls: Any) -> None:
    cls.__class_getitem__ = classmethod(lambda cls, *a: cls)


def _patch_distutils_version() -> None:
    """Keep legacy redis-py 3.x importable on Python 3.13+.

    Python 3.12 removed ``distutils``, but the redis-py version currently
    required by Sentry still imports ``distutils.version.StrictVersion`` at
    module import time.  ``packaging.version.Version`` provides the same
    comparison behavior needed by redis-py, so install only that narrow
    compatibility module instead of adding setuptools back as a dependency.
    """
    try:
        __import__("distutils.version", fromlist=["StrictVersion"])
    except ModuleNotFoundError:
        from packaging.version import Version

        version_module = types.ModuleType("distutils.version")
        setattr(version_module, "StrictVersion", Version)

        distutils_module = types.ModuleType("distutils")
        setattr(distutils_module, "__path__", [])
        setattr(distutils_module, "version", version_module)

        sys.modules["distutils"] = distutils_module
        sys.modules["distutils.version"] = version_module


_patch_distutils_version()


def _patch_generics() -> None:
    for modname, clsname in (
        # not all django types are generic at runtime
        # this is a lightweight version of `django-stubs-ext`
        ("django.db.models.fields", "Field"),
        # only generic in stubs
        ("parsimonious.nodes", "NodeVisitor"),
    ):
        try:
            mod = __import__(modname, fromlist=["_trash"])
        except ImportError:
            pass
        else:
            getattr(mod, clsname).__class_getitem__ = classmethod(lambda cls, *a: cls)


_patch_generics()
