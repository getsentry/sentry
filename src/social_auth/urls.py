from django.urls import re_path

from social_auth.views import auth

urlpatterns = [
    re_path(
        r"^associate/(?P<backend>[^/]+)/$",
        auth,
        name="socialauth_associate",
    ),
]
