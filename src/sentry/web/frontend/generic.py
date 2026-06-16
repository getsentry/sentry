import os
import posixpath
from urllib.parse import unquote

from django.conf import settings
from django.contrib.staticfiles import finders
from django.http import Http404, HttpResponseNotFound
from django.views import static

from sentry.utils.assets import get_frontend_app_asset_module_path
from sentry.web.constants import FOREVER_CACHE, NEVER_CACHE, NO_CACHE
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


@all_silo_view
def frontend_app_static_media(request, **kwargs):
    """
    Serve static files that should not have any versioned paths/filenames.
    These assets will have cache headers to say that it can be cached by a
    client, but it *must* be validated against the origin server before the
    cached asset can be used.
    """

    path = kwargs.get("path", "")

    kwargs["path"] = f"dist/{path}"
    response = static_media(request, **kwargs)

    if not settings.DEBUG:
        response["Cache-Control"] = NO_CACHE

    return response


@all_silo_view
def service_worker(request):
    """
    Serve the service worker script from our own origin.

    Service workers must be served from the same origin as the scope they
    control. The built worker bundle lives in the frontend app's dist directory
    (served from the CDN under `_static/dist`), so we proxy it from disk here at
    a root-scoped path so it can register with `scope: '/'`.
    """
    path = get_frontend_app_asset_module_path("entrypoints/serviceWorker.js")
    response = static_media(request, module="sentry", path=f"dist/{path}")

    # Allow the worker to control the root scope and force revalidation so a new
    # deploy's worker is picked up without serving a stale cached copy.
    response["Service-Worker-Allowed"] = "/"
    if not settings.DEBUG:
        response["Cache-Control"] = NO_CACHE

    return response


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
