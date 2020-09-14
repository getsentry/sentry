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


def patch_parse_cookie():
    try:
        from django.utils import six
        from django.utils.encoding import force_str
        from django.utils.six.moves import http_cookies
        from django import http
    except ImportError:
        # This module is potentially imported before Django is installed
        # during a setup.py run
        return

    # Backported from 1.8.15: https://github.com/django/django/blob/1.8.15/django/http/cookie.py#L91
    # See https://www.djangoproject.com/weblog/2016/sep/26/security-releases/ for more context.
    def safe_parse_cookie(cookie):
        """
        Return a dictionary parsed from a `Cookie:` header string.
        """
        cookiedict = {}
        if six.PY2:
            cookie = force_str(cookie)
        for chunk in cookie.split(";"):
            if "=" in chunk:
                key, val = chunk.split("=", 1)
            else:
                # Assume an empty name per
                # https://bugzilla.mozilla.org/show_bug.cgi?id=169091
                key, val = "", chunk
            key, val = key.strip(), val.strip()
            if key or val:
                # unquote using Python's algorithm.
                cookiedict[key] = http_cookies._unquote(val)
        return cookiedict

    http.parse_cookie = safe_parse_cookie


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


for patch in (
    patch_parse_cookie,
    patch_httprequest_repr,
    patch_django_views_debug,
    patch_celery_imgcat,
    patch_pickle_loaders,
):
    patch()
