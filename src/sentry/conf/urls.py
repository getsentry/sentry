from __future__ import absolute_import

from django.conf import settings
from django.conf.urls import url


from sentry.web.urls import urlpatterns as web_urlpatterns
from sentry.web.frontend.csrf_failure import CsrfFailureView
from sentry.web.frontend.error_404 import Error404View
from sentry.web.frontend.error_500 import Error500View

handler404 = Error404View.as_view()
handler500 = Error500View.as_view()

urlpatterns = [
    url(r"^500/", handler500, name="error-500"),
    url(r"^404/", handler404, name="error-404"),
    url(r"^403-csrf-failure/", CsrfFailureView.as_view(), name="error-403-csrf-failure"),
]

if "django.contrib.admin" in settings.INSTALLED_APPS:
    from sentry import django_admin

    urlpatterns += django_admin.urlpatterns

urlpatterns += web_urlpatterns
