from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from sentry.api.base import Endpoint


class AuthV2Flag(BasePermission):
    def has_permission(self, request: Request, view: object) -> bool:
        if settings.IS_DEV:
            return True

        secret = request.META.get("X-Sentry-Auth-V2")
        return secret == settings.AUTH_V2_SECRET


class AuthV2Endpoint(Endpoint):
    permission_classes = (AuthV2Flag,)
