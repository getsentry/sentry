def register_scheme(name: str) -> None:
    """Registers a new URL scheme by adding it to the appropriate lists.

    This function checks the predefined lists of URL schemes and appends the
    specified scheme name if it is not already present.

    Args:
        name: The name of the URL scheme to register.

    Returns:
        None
    """
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


def patch_django_generics() -> None:
    # not all django types are generic at runtime
    # this is a lightweight version of `django-stubs-ext`
    try:
        from django.db.models.fields import Field
    except ImportError:
        pass
    else:
        Field.__class_getitem__ = classmethod(lambda cls, *a: cls)  # type: ignore[attr-defined]


patch_django_generics()
