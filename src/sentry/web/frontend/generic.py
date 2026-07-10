import os
import posixpath
from urllib.parse import unquote

from django.conf import settings
from django.contrib.staticfiles import finders
from django.http import Http404, HttpResponse, HttpResponseNotFound, HttpResponseNotModified
from django.views import static
from requests.exceptions import RequestException

from sentry.http import safe_urlopen
from sentry.utils.assets import (
    get_frontend_app_asset_module_path,
    get_frontend_app_asset_url,
    get_frontend_commit_sha,
)
from sentry.web.constants import FOREVER_CACHE, NEVER_CACHE, NO_CACHE
from sentry.web.frontend.base import all_silo_view, control_silo_view


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


# In-memory stash of the proxied service worker bundle, keyed by the frontend
# commit SHA. Frontend assets are content-hashed, so the bundle is immutable for
# a given SHA: once fetched we can serve it from memory until the next frontend
# deploy bumps the SHA. New deploys, or fleet scale-up operations will bring up
# new python processes without any cache set.
_worker_bundle_cache: tuple[str, bytes] | None = None


def _fetch_worker_bundle(commit_sha: str) -> bytes | None:
    """
    Return the service worker bundle for ``commit_sha``, fetching it from the
    frontend CDN on a cache miss and stashing it in memory for later requests.
    Returns ``None`` if the CDN fetch fails.
    """
    global _worker_bundle_cache

    cached = _worker_bundle_cache
    if cached is not None and cached[0] == commit_sha:
        return cached[1]

    try:
        # `get_frontend_app_asset_url` resolves the hashed entrypoint via the
        # frontend-versions manifest, which can `KeyError` during a deploy
        # window where the backend ships before the manifest lists the worker.
        url = get_frontend_app_asset_url("sentry", "entrypoints/service-worker.js")
        upstream = safe_urlopen(url, method="GET", timeout=5)
        upstream.raise_for_status()
    except (KeyError, RequestException):
        return None

    # Only a 200 carries the real asset; anything else is treated as a miss
    # including 3xx redirects.
    if upstream.status_code != 200:
        return None

    content = upstream.content
    # Atomic rebind; concurrent cold-cache fetches just race to the same value.
    _worker_bundle_cache = (commit_sha, content)
    return content


@control_silo_view
def service_worker(request):
    """
    Serve the service worker script from our own origin.

    Service workers must be served from the same origin as the scope they
    control, with a ``Service-Worker-Allowed: /`` header so they can register
    with ``scope: '/'``.

    In deployed environments the built worker bundle lives on the frontend CDN,
    which the backend doesn't have on local disk, so we proxy it. The frontend
    commit SHA is used as the response ``ETag`` — it's stable for a given
    frontend deploy — so clients revalidate with ``If-None-Match`` and we answer
    ``304 Not Modified`` without re-sending the body. For self-hosted / local
    dev (no ``frontend-versions.json``, relative asset URL) we serve the bundle
    straight from disk instead.
    """
    commit_sha = get_frontend_commit_sha()

    if commit_sha is not None and settings.STATIC_FRONTEND_APP_URL.startswith("https://"):
        # Inbound revalidation: the client already has this frontend version.
        if request.META.get("HTTP_IF_NONE_MATCH") == commit_sha:
            return HttpResponseNotModified()

        content = _fetch_worker_bundle(commit_sha)
        if content is None:
            # The worker is non-critical (client registration ignores failures),
            # so degrade to a 404 rather than surfacing a 500.
            return HttpResponseNotFound("", content_type="text/plain")

        response = HttpResponse(content, content_type="text/javascript")
        response["ETag"] = f'"{commit_sha}"'
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = NO_CACHE
    else:
        try:
            # No frontend-versions config here, so the lookup returns the key
            # verbatim (no manifest indirection) and serves the bundle from disk.
            path = get_frontend_app_asset_module_path("entrypoints/service-worker.js")
            response = static_media(request, module="sentry", path=f"dist/{path}")
            if not settings.DEBUG:
                response["Cache-Control"] = NO_CACHE
        except KeyError:
            return HttpResponseNotFound("", content_type="text/plain")

    # Allow the worker to control the root scope regardless of the path it's
    # served from.
    response["Service-Worker-Allowed"] = "/"
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
