from django.urls import re_path

from sentry.auth_v2.endpoints.user_login_view import UserLoginView

"""
NOTE(dlee): Every endpoint must be protected by the "organizations:auth-v2" feature flag.
"""
AUTH_V2_URLS = [
    re_path(
        r"^login/$",
        UserLoginView.as_view(),
        name="sentry-api-0-auth-v2-login",
    ),
]
