"""
sentry.conf.urls
~~~~~~~~~~~~~~~~

These are additional urls used by the Sentry-provided web server

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import debug_toolbar

try:
    from django.conf.urls import include, patterns, url
except ImportError:
    # django < 1.5 compat
    from django.conf.urls.defaults import include, patterns, url  # NOQA
from django.views.defaults import page_not_found
from django.http import HttpResponse

from sentry import django_admin, status_checks
from sentry.utils import json
from sentry.web.urls import urlpatterns as web_urlpatterns
from sentry.web.frontend.csrf_failure import CsrfFailureView
from sentry.web.frontend.error_500 import Error500View

handler404 = lambda x: page_not_found(x, template_name='sentry/404.html')
handler500 = Error500View.as_view()


def handler_healthcheck(request):
    problems, checks = status_checks.check_all()

    if request.GET.get('full'):
        return HttpResponse(json.dumps({
            'problems': map(unicode, problems),
            'healthy': checks,
        }), content_type='application/json', status=(500 if problems else 200))
    elif problems:
        return handler500(request)
    else:
        return HttpResponse('ok')


urlpatterns = patterns(
    '',
    url(r'^admin/', include(django_admin.site.urls)),
    url(r'^500/', handler500, name='error-500'),
    url(r'^404/', handler404, name='error-400'),
    url(r'^_health/$', handler_healthcheck, name='healthcheck'),
    url(r'^403-csrf-failure/', CsrfFailureView.as_view(), name='error-403-csrf-failure'),
    url(r'^__debug__/', include(debug_toolbar.urls)),
) + web_urlpatterns
