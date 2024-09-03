from django.urls import re_path

from social_auth.views import auth, complete

urlpatterns = [
    # authentication
    re_path(
        r"^associate/complete/(?P<backend>[^/]+)/$", complete, name="socialauth_associate_complete"
    ),
    re_path(
        r"^associate/complete/(?P<backend>[^/]+)/auth/sso/$",
        complete,
        name="socialauth_associate_complete_auth_sso",
    ),
    re_path(
        r"^associate/(?P<backend>[^/]+)/$",
        auth,
        name="socialauth_associate",
    ),
]
