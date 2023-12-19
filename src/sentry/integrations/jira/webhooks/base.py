from __future__ import annotations

import abc
import logging
from typing import Any, MutableMapping

from django.views.decorators.csrf import csrf_exempt
from psycopg2 import OperationalError
from rest_framework import status
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import Scope

from sentry.api.base import Endpoint
from sentry.integrations.utils.atlassian_connect import AtlassianConnectValidationError, get_token
from sentry.shared_integrations.exceptions import ApiError

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
        handler_context: MutableMapping[str, Any] | None = None,
        scope: Scope | None = None,
    ) -> Response:
        handler_context = handler_context or {}
        scope = scope or Scope()

        if isinstance(exc, (AtlassianConnectValidationError, JiraTokenError)):
            return self.respond(status=status.HTTP_409_CONFLICT)

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

        # Handle and clean up known errors, and flag unknown ones by logging an exception
        if isinstance(exc, ApiError):
            # Pull off "com.atlassian.jira.issue:sentry.io.jira:sentry-issues-glance:status"
            # and the like - what we really care about is which Jira API endpoint we were
            # trying to hit
            jira_api_endpoint = (
                exc.path.split("com.atlassian.jira")[0] if exc.path else "[unknown endpoint]"
            )

            scope.set_tag("jira.host", exc.host)
            scope.set_tag("jira.endpoint", jira_api_endpoint)

            # If the error message is a big mess of html or xml, move it to `handler_context`
            # so we can see it if we need it, but also can replace the error message
            # with a much more helpful one
            if "doctype html" in exc.text.lower() or "<html" in exc.text.lower():
                handler_context["html_response"] = exc.text
            elif "<?xml" in exc.text.lower():
                handler_context["xml_response"] = exc.text

            if handler_context.get("html_response") or handler_context.get("xml_response"):
                if exc.code == 401:
                    exc.text = f"Unauthorized request to {jira_api_endpoint}"
                elif exc.code == 429:
                    exc.text = f"Rate limit hit when requesting {jira_api_endpoint}"
                # TODO: The two 500s might be better as metrics rather than ending up as events
                # in Sentry
                elif exc.code == 502:
                    exc.text = f"Bad gateway when connecting to {jira_api_endpoint}"
                elif exc.code == 504:
                    exc.text = f"Gateway timeout when connecting to {jira_api_endpoint}"
                else:  # generic ApiError
                    exc.text = f"Unknown error when requesting {jira_api_endpoint}"
                    logger.error("Unclear JIRA exception")

        # OperationalErrors are errors talking to our postgres DB
        elif isinstance(exc, OperationalError):
            pass  # No processing needed and these are known errors
        else:
            logger.error("Unclear JIRA exception")

        # This will log the error locally, capture the exception and send it to Sentry, and create a
        # generic 500/Internal Error response
        return super().handle_exception(request, exc, handler_context, scope)

    def get_token(self, request: Request) -> str:
        try:
            return get_token(request)
        except AtlassianConnectValidationError:
            raise JiraTokenError
