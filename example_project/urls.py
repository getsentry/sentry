from django.conf.urls.defaults import *

urlpatterns = patterns('',
    url(r'^debug/', include('tests.urls')),
    url(r'^', include('sentry.web.urls')),
)
