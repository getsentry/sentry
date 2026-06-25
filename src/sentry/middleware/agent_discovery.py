from __future__ import annotations

from collections.abc import Callable

from django.conf import settings
from django.http import HttpRequest
from django.http.response import HttpResponseBase

from sentry.conf.types.sentry_config import SentryMode

AGENT_DISCOVERY_LINK_HEADER = (
    '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"'
    ', </.well-known/oauth-protected-resource>; rel="oauth-protected-resource"; type="application/json"'
    ', </.well-known/oauth-authorization-server>; rel="oauth-authorization-server"; type="application/json"'
    ', </.well-known/mcp/server-card.json>; rel="https://modelcontextprotocol.io/rel/server-card"; type="application/json"'
    ', </.well-known/agent-skills/index.json>; rel="https://agentskills.io/rel/skills-index"; type="application/json"'
    ', <https://docs.sentry.io/api/>; rel="service-doc"; type="text/html"'
)


class AgentDiscoveryMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponseBase]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponseBase:
        response = self.get_response(request)

        if settings.SENTRY_MODE != SentryMode.SAAS:
            return response

        if getattr(request, "subdomain", None):
            return response

        if request.path.startswith("/api/"):
            return response

        content_type = response.get("Content-Type", "")
        if "text/html" not in content_type:
            return response

        existing = response.get("Link", "")
        if existing:
            response["Link"] = existing + ", " + AGENT_DISCOVERY_LINK_HEADER
        else:
            response["Link"] = AGENT_DISCOVERY_LINK_HEADER

        return response
