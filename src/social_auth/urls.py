"""URLs module"""
try: 
    from django.conf.urls import patterns, url 
except ImportError: 
    # for Django version less then 1.4
    from django.conf.urls.defaults import patterns, url
    
from social_auth.views import auth, complete, disconnect


urlpatterns = patterns('',
    # authentication
    url(r'^login/(?P<backend>[^/]+)/$', auth,
        name='socialauth_begin'),
    url(r'^complete/(?P<backend>[^/]+)/$', complete,
        name='socialauth_complete'),

    # XXX: Deprecated, this URLs are deprecated, instead use the login and
    #      complete ones directly, they will differentiate the user intention
    #      by checking it's authenticated status association.
    url(r'^associate/(?P<backend>[^/]+)/$', auth,
        name='socialauth_associate_begin'),
    url(r'^associate/complete/(?P<backend>[^/]+)/$', complete,
        name='socialauth_associate_complete'),

    # disconnection
    url(r'^disconnect/(?P<backend>[^/]+)/$', disconnect,
        name='socialauth_disconnect'),
    url(r'^disconnect/(?P<backend>[^/]+)/(?P<association_id>[^/]+)/$',
        disconnect, name='socialauth_disconnect_individual'),
)
