from __future__ import annotations

import abc

from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.integrations.utils import AtlassianConnectValidationError


class JiraTokenError(Exception):
    pass


class JiraEndpointBase(Endpoint, abc.ABC):
    authentication_classes = ()
    permission_classes = ()
    provider = "jira"

    @csrf_exempt
    def dispatch(self, request: Request, *args, **kwargs) -> Response:
        return super().dispatch(request, *args, **kwargs)

    def handle_exception(self, request: Request, exc: Exception) -> Response:
        if isinstance(exc, (AtlassianConnectValidationError, JiraTokenError)):
            return self.respond(status=status.HTTP_400_BAD_REQUEST)
        return super().handle_exception(request, exc)

    def get_token(self, request: Request) -> str:
        try:
            return request.META["HTTP_AUTHORIZATION"].split(" ", 1)[1]
        except (KeyError, IndexError):
            raise JiraTokenError
