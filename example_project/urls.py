from django.conf.urls.defaults import *

urlpatterns = patterns('',
    url(r'^trigger-500$', 'sentry.tests.views.raise_exc', name='sentry-raise-exc'),
    url(r'^', include('sentry.urls')),
)
