# TODO(dcramer): move our changes into social_auth
from __future__ import absolute_import, print_function

from django.conf.urls import patterns, url

from social_auth.views import complete
from sentry.social_auth.views import auth, disconnect


urlpatterns = patterns('',
    # authentication
    url(r'^associate/(?P<backend>[^/]+)/$', auth,
        name='socialauth_associate'),
    url(r'^associate/complete/(?P<backend>[^/]+)/$', complete,
        name='socialauth_associate_complete'),

    # disconnection
    url(r'^disconnect/(?P<backend>[^/]+)/$', disconnect,
        name='socialauth_disconnect'),
    url(r'^disconnect/(?P<backend>[^/]+)/(?P<association_id>[^/]+)/$',
        disconnect, name='socialauth_disconnect_individual'),
)
