from __future__ import annotations

import abc
import logging
from typing import Any, Mapping

from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import Scope

from sentry.api.base import Endpoint
from sentry.integrations.utils import AtlassianConnectValidationError

logger = logging.getLogger(__name__)


class JiraTokenError(Exception):
    pass


class JiraWebhookBase(Endpoint, abc.ABC):
    """
    Base class for webhooks used in the Jira integration
    """

    authentication_classes = ()
    permission_classes = ()
    provider = "jira"

    @csrf_exempt
    def dispatch(self, request: Request, *args, **kwargs) -> Response:
        return super().dispatch(request, *args, **kwargs)

    def handle_exception(
        self,
        request: Request,
        exc: Exception,
        handler_context: Mapping[str, Any] | None = None,
        scope: Scope | None = None,
    ) -> Response:
        if isinstance(exc, (AtlassianConnectValidationError, JiraTokenError)):
            return self.respond(status=status.HTTP_400_BAD_REQUEST)

        # Atlassian has an automated tool which tests to make sure integrations with Jira
        # (like ours) pass certain security requirements, which leads them to probe certain
        # of our endpoints to make sure we're not accepting insecure GET requests. Not
        # actionable on our part and therefore not worth sending to Sentry.
        if isinstance(
            exc, MethodNotAllowed
        ) and "github.com/atlassian-labs/connect-security-req-tester" in request.headers.get(
            "User-Agent", ""
        ):
            logger.info(
                "Atlassian Connect Security Request Tester tried disallowed method",
                extra={"path": request.path, "method": request.method},
            )
            return self.respond(status=status.HTTP_405_METHOD_NOT_ALLOWED)
        # Perhaps it makes sense to do this in the base class, however, I'm concerned
        # it would create too many errors at once and may be grouped together
        logger.exception("Unclear JIRA exception.")
        return super().handle_exception(request, exc, handler_context, scope)

    def get_token(self, request: Request) -> str:
        try:
            return request.META["HTTP_AUTHORIZATION"].split(" ", 1)[1]
        except (KeyError, IndexError):
            raise JiraTokenError
