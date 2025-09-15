from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from sentry.api.base import Endpoint


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
