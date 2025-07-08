import logging
from typing import Any

from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from sentry.api.base import Endpoint

logger = logging.getLogger("sentry.auth_v2.secret_bug")


def match_chars(str1: str | Any, str2: str | Any) -> str:
    str1, str2 = str1 or "", str2 or ""
    return "".join("-" if c1 == c2 else "X" for c1, c2 in zip(str1, str2))


def mask_string(s: str | Any) -> str:
    s = s or ""
    if len(s) <= 4:
        return s
    return s[:2] + "-" * (len(s) - 4) + s[-2:]


class AuthV2Permission(BasePermission):
    def has_permission(self, request: Request, view: object) -> bool:
        if settings.IS_DEV:
            return True

        # WARN: If the secret is not set on production, we must fail the request.
        if not settings.AUTH_V2_SECRET:
            return False

        return request.META.get("HTTP_X_SENTRY_AUTH_V2") == settings.AUTH_V2_SECRET


class AuthV2Endpoint(Endpoint):
    permission_classes = (AuthV2Permission,)
