from django.urls import re_path

from sentry.auth_v2.endpoints.auth_user_merge_verification_code import (
    AuthUserMergeVerificationCodeEndpoint,
)
from sentry.auth_v2.endpoints.csrf import CsrfTokenEndpoint
from sentry.auth_v2.endpoints.feature_flag_view import FeatureFlagView
from sentry.auth_v2.endpoints.user_login_view import UserLoginView

"""
NOTE(dlee): Every endpoint must be protected by the "organizations:auth-v2" feature flag.
"""
AUTH_V2_URLS = [
    re_path(
        r"^flag/$",  # TODO(dlee): Remove this when we remove X-Sentry-Auth-V2 header
        FeatureFlagView.as_view(),
        name="sentry-api-0-auth-v2-feature-flag",
    ),
    re_path(
        r"^csrf/$",
        CsrfTokenEndpoint.as_view(),
        name="sentry-api-0-auth-v2-csrf",
    ),
    re_path(
        r"^login/$",
        UserLoginView.as_view(),
        name="sentry-api-0-auth-v2-login",
    ),
    re_path(
        r"^user-merge-verification-codes/$",
        AuthUserMergeVerificationCodeEndpoint.as_view(),
        name="sentry-api-0-auth-verification-codes",
    ),
]
