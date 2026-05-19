import os
import posixpath
import re
from urllib.parse import unquote

from django.conf import settings
from django.contrib.staticfiles import finders
from django.http import Http404, HttpResponseNotFound
from django.views import static

from sentry.web.constants import FOREVER_CACHE, IMMUTABLE_CACHE, NEVER_CACHE, NO_CACHE
from sentry.web.frontend.base import all_silo_view


def dev_favicon(request, extension):
    document_root, path = resolve("sentry/images/favicon-dev.png")
    return static.serve(request, path, document_root=document_root)


def resolve(path):
    # Mostly yanked from Django core and changed to return the path:
    # See: https://github.com/django/django/blob/1.6.11/django/contrib/staticfiles/views.py
    normalized_path = posixpath.normpath(unquote(path)).lstrip("/")
    try:
        absolute_path = finders.find(normalized_path)
    except Exception:
        # trying to access bad paths like, `../../etc/passwd`, etc that
        # Django rejects, but respond nicely instead of erroring.
        absolute_path = None
    if not absolute_path:
        raise Http404("'%s' could not be found" % path)
    if path[-1] == "/" or os.path.isdir(absolute_path):
        raise Http404("Directory indexes are not allowed here.")
    return os.path.split(absolute_path)


_CONTENT_HASHED_ASSET_RE = re.compile(r"\.[0-9a-f]{16,}\.\w+(?:\.gz)?$")
_CACHEABLE_DIST_DIRS = ("chunks/", "assets/")


@all_silo_view
def frontend_app_static_media(request, **kwargs):
    """
    Serve static files from the frontend build output (/_static/dist/).

    Files in chunks/ and assets/ whose filenames contain a content hash
    are immutable and cached forever. Everything else (entrypoints like
    app.js, sentry.css) must be revalidated on each request.
    """

    path = kwargs.get("path", "")

    kwargs["path"] = f"dist/{path}"
    response = static_media(request, **kwargs)

    if not settings.DEBUG:
        if _is_content_hashed_asset(path):
            response["Cache-Control"] = IMMUTABLE_CACHE
        else:
            response["Cache-Control"] = NO_CACHE

    return response


def _is_content_hashed_asset(path: str) -> bool:
    return path.startswith(_CACHEABLE_DIST_DIRS) and bool(
        _CONTENT_HASHED_ASSET_RE.search(os.path.basename(path))
    )


@all_silo_view
def static_media(request, **kwargs):
    """
    Serve static files below a given point in the directory structure.
    """
    module = kwargs.get("module")
    path = kwargs.get("path", "")
    version = kwargs.get("version")

    if module:
        path = f"{module}/{path}"

    try:
        document_root, path = resolve(path)
    except Http404:
        # Return back a simpler plain-text 404 response, more suitable
        # for static files, rather than our full blown HTML.
        return HttpResponseNotFound("", content_type="text/plain")

    response = None

    if (
        "gzip" in request.META.get("HTTP_ACCEPT_ENCODING", "")
        and not path.endswith(".gz")
        and not settings.DEBUG
    ):
        try:
            response = static.serve(request, path + ".gz", document_root=document_root)
        except Http404:
            pass

    if response is None:
        # We don't need to handle Http404 since `resolve()` is assuring to us
        # that at least the non-gzipped version exists, so in theory, this can
        # only happen on the first .gz path
        response = static.serve(request, path, document_root=document_root)

    # Make sure we Vary: Accept-Encoding for gzipped responses
    response["Vary"] = "Accept-Encoding"

    # We need CORS for font files
    if path.endswith((".js", ".ttf", ".ttc", ".otf", ".eot", ".woff", ".woff2")):
        response["Access-Control-Allow-Origin"] = "*"

    # If we have a version and not DEBUG, we can cache it FOREVER
    if version is not None and not settings.DEBUG:
        response["Cache-Control"] = FOREVER_CACHE
    else:
        # Otherwise, we explicitly don't want to cache at all
        response["Cache-Control"] = NEVER_CACHE

    return response
