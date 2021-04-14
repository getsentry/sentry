from django.conf.urls import url

from social_auth.views import auth, complete

urlpatterns = [
    # authentication
    url(
        r"^associate/complete/(?P<backend>[^/]+)/$", complete, name="socialauth_associate_complete"
    ),
    url(r"^associate/(?P<backend>[^/]+)/$", auth, name="socialauth_associate"),
]
