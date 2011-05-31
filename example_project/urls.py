from django.conf.urls.defaults import *

urlpatterns = patterns('',
    url(r'^', include('sentry.web.urls')),
)
