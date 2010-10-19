from django.conf.urls.defaults import *

urlpatterns = patterns('',
    url(r'^', include('sentry.tests.urls')),
)
