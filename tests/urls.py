from django.conf.urls.defaults import *
from django.contrib import admin

admin.autodiscover()

urlpatterns = patterns('',
    url(r'^admin/', include(admin.site.urls)),
    url(r'^trigger-500$', 'tests.views.raise_exc', name='sentry-raise-exc'),
    url(r'^trigger-500-decorated$', 'tests.views.decorated_raise_exc', name='sentry-raise-exc-decor'),
    url(r'^trigger-500-django$', 'tests.views.django_exc', name='sentry-django-exc'),
    url(r'^trigger-500-template$', 'tests.views.template_exc', name='sentry-template-exc'),
    url(r'^trigger-500-log-request$', 'tests.views.logging_request_exc', name='sentry-log-request-exc'),
    url(r'', include('sentry.web.urls')),
)