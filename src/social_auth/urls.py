from __future__ import absolute_import

try:
    from django.conf.urls import url
except ImportError:
    # for Django version less then 1.4
    from django.conf.urls.defaults import url

from social_auth.views import auth, complete


urlpatterns = [
    # authentication
    url(
        r"^associate/complete/(?P<backend>[^/]+)/$", complete, name="socialauth_associate_complete"
    ),
    url(r"^associate/(?P<backend>[^/]+)/$", auth, name="socialauth_associate"),
]
