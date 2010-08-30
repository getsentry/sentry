from django.conf.urls.defaults import *
from django.contrib import admin

admin.autodiscover()

urlpatterns = patterns('',
    url(r'^admin/', include(admin.site.urls)),
    url(r'^$', 'dblog.tests.views.raise_exc', name='dblog-raise-exc'),
    url(r'', include('dblog.urls')),
)