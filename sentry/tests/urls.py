from django.conf.urls.defaults import *
from django.contrib import admin

admin.autodiscover()

urlpatterns = patterns('',
    url(r'^admin/', include(admin.site.urls)),
    url(r'^trigger-500$', 'sentry.tests.views.raise_exc', name='sentry-raise-exc'),
    url(r'^trigger-500-decorated$', 'sentry.tests.views.decorated_raise_exc', name='sentry-raise-exc-decor'),
    url(r'^trigger-500-django$', 'sentry.tests.views.django_exc', name='sentry-django-exc'),
    url(r'^trigger-500-template$', 'sentry.tests.views.template_exc', name='sentry-template-exc'),
    url(r'^trigger-500-log-request$', 'sentry.tests.views.logging_request_exc', name='sentry-log-request-exc'),
    url(r'', include('sentry.urls')),
)