from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from django.http import HttpRequest

from sentry.web.client_config import get_client_config


def react_config(request: HttpRequest) -> Mapping[str, Any]:
    """
    Inject ``react_config`` into every ``RequestContext`` so that templates that
    extend ``sentry/layout.html`` can render ``window.__initialData`` via
    ``{{ react_config|to_json }}`` without each view remembering to plumb it.

    Historically each view that rendered ``layout.html`` had to inject
    ``react_config`` into its own template context; missing the injection
    produced a broken SPA shell (``window.__initialData = {};``) and shipped
    four separate regressions before this was centralised. Running as a
    context processor closes that class of bug by default.

    The active organization context is sourced from
    ``request._sentry_active_organization`` when ``determine_active_organization``
    has already run (which happens for every view inheriting ``BaseView``).
    We deliberately do NOT call ``determine_active_organization`` here to
    avoid a second, view-layer-owned ``auth.set_active_org`` write that
    would leak active-org state into sessions for views that would not
    otherwise own that side effect (see the customer-domain non-member
    access-control tests in ``tests/sentry/web/frontend/test_react_page.py``).

    Note that ``get_client_config`` itself may still clear ``activeorg``
    via ``_delete_activeorg`` when the session's last-active org is no
    longer resolvable for the current user. That behaviour is unchanged
    from the prior per-view injection code path — we're just running it
    on every HTML render uniformly now, which means a handful of previously
    read-only paths (e.g. 404/500 and debug HTML rendered with
    ``RequestContext``) also participate in that cleanup. This is desirable:
    stale session pointers get reaped everywhere instead of only on pages
    that happened to inject ``react_config``.

    The computed dict is memoised on ``request`` so repeat access within the
    same request is free, and so downstream context processors (e.g.
    getsentry's augmenter) observe the same object they can mutate.

    Requests that have not passed through auth / session middleware (some
    test harnesses construct bare ``WSGIRequest`` objects directly, and the
    ``pipeline`` subsystem passes a raw ``request`` to ``render_to_response``)
    are skipped: ``get_client_config`` and its transitive callees access
    ``request.session`` / ``request.user`` / ``request.META['REMOTE_ADDR']``
    unconditionally. Such requests never need a populated bootstrap because
    their templates are either non-SPA (error / debug pages) or their views
    only assert on response status codes in tests. Returning an empty dict
    makes the base template's ``{% if react_config %}`` guard emit
    ``window.__initialData = {}`` which is a valid no-op bootstrap.
    """

    cached = getattr(request, "_sentry_react_config", None)
    if cached is not None:
        return {"react_config": cached}

    # Full middleware stack (auth / session) leaves these three attributes
    # on every request. Tests and pipeline harnesses that construct bare
    # ``HttpRequest``/``WSGIRequest`` objects may lack one or more of them;
    # bail out with a minimal dict so the base layout's guard produces
    # ``window.__initialData = {}`` instead of crashing the render.
    if not all(hasattr(request, attr) for attr in ("session", "user", "auth")):
        return {}

    org_context = getattr(request, "_sentry_active_organization", None)
    value = dict(get_client_config(request, org_context))
    request._sentry_react_config = value
    return {"react_config": value}
