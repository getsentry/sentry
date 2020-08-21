from __future__ import absolute_import

from .pickle import patch_pickle_loaders


def register_scheme(name):
    try:
        import urlparse  # NOQA
    except ImportError:
        from urllib import parse as urlparse  # NOQA
    uses = urlparse.uses_netloc, urlparse.uses_query, urlparse.uses_relative, urlparse.uses_fragment
    for use in uses:
        if name not in use:
            use.append(name)


register_scheme("app")
register_scheme("chrome-extension")


def patch_httprequest_repr():
    try:
        from django.http import HttpRequest
    except ImportError:
        # This module is potentially imported before Django is installed
        # during a setup.py run
        return

    # Intentionally strip all GET/POST/COOKIE values out of repr() for HttpRequest
    # and subclass WSGIRequest. This prevents sensitive information from getting
    # logged. This was yanked out of Django master anyhow.
    # https://code.djangoproject.com/ticket/12098
    def safe_httprequest_repr(self):
        return "<%s: %s %r>" % (self.__class__.__name__, self.method, self.get_full_path())

    HttpRequest.__repr__ = safe_httprequest_repr


def patch_django_views_debug():
    # Prevent exposing any Django SETTINGS on our debug error page
    # This information is not useful for Sentry development
    # and poses a significant security risk if this is exposed by accident
    # in any production system if, by change, it were deployed
    # with DEBUG=True.
    try:
        from django.views import debug
    except ImportError:
        return

    debug.get_safe_settings = lambda: {}


def patch_celery_imgcat():
    # Remove Celery's attempt to display an rgb image in iTerm 2, as that
    # attempt just prints out base64 trash in tmux.
    try:
        from celery.utils import term
    except ImportError:
        return

    term.imgcat = lambda *a, **kw: b""


def patch_django_email_validator():
    # Django's EmailValidator doesn't allow for emails with [] in the local part.
    # This causes commits from Github's Dependabot to fail when trying to attach them to a release
    # e.g. https://github.com/getsentry/sentry/issues/20085
    try:
        import re
        from django.core.validators import _lazy_re_compile, EmailValidator
    except ImportError:
        return

    email_regex = _lazy_re_compile(
        r"(^[-!#$%&'*+/=?^_`{}|~0-9A-Z\[\]]+(\.[-!#$%&'*+/=?^_`{}|~0-9A-Z]+)*\Z"  # dot-atom
        r'|^"([\001-\010\013\014\016-\037!#-\[\]-\177]|\\[\001-\011\013\014\016-\177])*"\Z)',  # quoted-string
        re.IGNORECASE,
    )

    EmailValidator.user_regex = email_regex


for patch in (
    patch_httprequest_repr,
    patch_django_views_debug,
    patch_celery_imgcat,
    patch_pickle_loaders,
    patch_django_email_validator,
):
    patch()
