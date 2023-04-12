from __future__ import annotations

import abc
import logging
from typing import Any, Mapping

from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.integrations.utils import AtlassianConnectValidationError

logger = logging.getLogger(__name__)


class JiraTokenError(Exception):
    pass


class JiraEndpointBase(Endpoint, abc.ABC):
    authentication_classes = ()
    permission_classes = ()
    provider = "jira"

    @csrf_exempt
    def dispatch(self, request: Request, *args, **kwargs) -> Response:
        return super().dispatch(request, *args, **kwargs)

    def handle_exception(
        self, request: Request, exc: Exception, handler_context: Mapping[str, Any] | None = None
    ) -> Response:
        if isinstance(exc, (AtlassianConnectValidationError, JiraTokenError)):
            return self.respond(status=status.HTTP_400_BAD_REQUEST)
        # Perhaps it makes sense to do this in the base class, however, I'm concerned
        # it would create too many errors at once and may be grouped together
        logger.exception("Unclear JIRA exception.")
        return super().handle_exception(request, exc, handler_context)

    def get_token(self, request: Request) -> str:
        try:
            return request.META["HTTP_AUTHORIZATION"].split(" ", 1)[1]
        except (KeyError, IndexError):
            raise JiraTokenError
