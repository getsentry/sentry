from django.conf.urls.defaults import *
from django.contrib import admin

admin.autodiscover()

urlpatterns = patterns('',
    url(r'^admin/', include(admin.site.urls)),
    url(r'^$', 'sentry.tests.views.raise_exc', name='sentry-raise-exc'),
    url(r'', include('sentry.urls')),
)