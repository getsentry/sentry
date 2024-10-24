from __future__ import annotations

from sentry.web.frontend.error_404 import Error404View
from sentry.web.frontend.error_500 import Error500View
from sentry.web.urls import urlpatterns as web_urlpatterns

# XXX: remove after getsentry does not reference these
handler404 = Error404View.as_view()
handler500 = Error500View.as_view()

urlpatterns = web_urlpatterns
