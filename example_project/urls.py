from django.conf.urls.defaults import *

admin.autodiscover()

urlpatterns = patterns('',
    (r'^admin/', include(admin.site.urls)),
    (r'^', include('dblog.urls')),
)
