from __future__ import annotations

from typing import Any


def register_scheme(name: str) -> None:
    from urllib import parse as urlparse

    uses = urlparse.uses_netloc, urlparse.uses_query, urlparse.uses_relative, urlparse.uses_fragment
    for use in uses:
        if name not in use:
            use.append(name)


register_scheme("app")
register_scheme("chrome-extension")


def patch_celery_imgcat() -> None:
    # Remove Celery's attempt to display an rgb image in iTerm 2, as that
    # attempt just prints out base64 trash in tmux.
    try:
        from celery.utils import term
    except ImportError:
        return

    term.imgcat = lambda *a, **kw: b""


patch_celery_imgcat()


def _add_class_getitem(cls: Any) -> None:
    cls.__class_getitem__ = classmethod(lambda cls, *a: cls)


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
