from __future__ import annotations

from django.urls import URLPattern, URLResolver, re_path

from sentry.api.endpoints.warmup import WarmupEndpoint
from sentry.web.frontend import csrf_failure
from sentry.web.frontend.error_404 import Error404View
from sentry.web.frontend.error_500 import Error500View
from sentry.web.urls import urlpatterns as web_urlpatterns

handler404 = Error404View.as_view()
handler500 = Error500View.as_view()

urlpatterns: list[URLResolver | URLPattern] = [
    re_path(
        r"^500/",
        handler500,
        name="error-500",
    ),
    re_path(
        r"^404/",
        handler404,
        name="error-404",
    ),
    re_path(
        r"^403-csrf-failure/",
        csrf_failure.view,
        name="error-403-csrf-failure",
    ),
    # warmup, used to initialize any connections / pre-load
    # the application so that user initiated requests are faster
    re_path(
        r"^_warmup/$",
        WarmupEndpoint.as_view(),
        name="sentry-warmup",
    ),
]

urlpatterns += web_urlpatterns
