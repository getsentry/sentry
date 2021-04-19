import os
import posixpath
from urllib.parse import unquote

from django.conf import settings
from django.contrib.staticfiles import finders
from django.http import Http404, HttpResponseNotFound
from django.views import static

FOREVER_CACHE = "max-age=315360000"
NEVER_CACHE = "max-age=0, no-cache, no-store, must-revalidate"


def dev_favicon(request, extension):
    document_root, path = resolve("sentry/images/favicon_dev.png")
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

    if (
        "gzip" in request.META.get("HTTP_ACCEPT_ENCODING", "")
        and not path.endswith(".gz")
        and not settings.DEBUG
    ):
        paths = (path + ".gz", path)
    else:
        paths = (path,)

    for p in paths:
        try:
            response = static.serve(request, p, document_root=document_root)
            break
        except Http404:
            # We don't need to handle this since `resolve()` is assuring to us that
            # at least the non-gzipped version exists, so in theory, this can
            # only happen on the first .gz path
            continue

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
