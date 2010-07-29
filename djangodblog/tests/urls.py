from django.conf.urls.defaults import *

urlpatterns = patterns('',
    url(r'^$', 'djangodblog.tests.views.raise_exc', name='dblog-raise-exc'),
)