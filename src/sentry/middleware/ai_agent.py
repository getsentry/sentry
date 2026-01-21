from __future__ import annotations

import json  # noqa: S003 - need stdlib json for indent support
import logging
import re
from typing import Any

from django.http import HttpRequest, HttpResponse

logger = logging.getLogger(__name__)

PATH_PATTERN = re.compile(r"^/organizations/([^/]+)/(?:projects/([^/]+)/)?")


def _build_mcp_config(org_slug: str | None, project_slug: str | None) -> dict[str, Any]:
    """Build the MCP server configuration object."""
    path_segments = ["https://mcp.sentry.dev/mcp"]
    if org_slug:
        path_segments.append(org_slug)
    if project_slug:
        path_segments.append(project_slug)

    return {
        "mcpServers": {
            "sentry": {
                "url": "/".join(path_segments),
            }
        }
    }


def _extract_org_project_from_path(path: str) -> tuple[str | None, str | None]:
    """Extract organization and project slugs from a URL path."""
    if match := PATH_PATTERN.match(path):
        return match.group(1), match.group(2)
    return None, None


def _build_ai_agent_guidance(request: HttpRequest) -> str:
    """Build context-aware guidance based on the request path."""
    org_slug, project_slug = _extract_org_project_from_path(request.path)

    mcp_config = _build_mcp_config(org_slug, project_slug)
    mcp_config_json = json.dumps(mcp_config, indent=2)

    return f"""\
# This Is the Web UI

It's HTML all the way down. You probably don't want to parse that.

## MCP Server

OAuth-authenticated, HTTP streaming—no `<div>` soup.

```json
{mcp_config_json}
```

Docs: https://mcp.sentry.dev

## REST API

```
curl https://sentry.io/api/0/projects/ \\
  -H "Authorization: Bearer <token>"
```

Your human can get a token at https://sentry.io/settings/account/api/auth-tokens/

Docs: https://docs.sentry.io/api/
"""


def _accepts_markdown(request: HttpRequest) -> bool:
    """Check if Accept header contains a markdown content type."""
    accept = request.META.get("HTTP_ACCEPT", "").lower()
    return "text/markdown" in accept or "text/x-markdown" in accept


class AIAgentMiddleware:
    """
    Middleware that intercepts unauthenticated frontend requests from AI agents
    and returns helpful markdown guidance instead of HTML.

    Detection criteria:
    1. Request path does NOT start with /api/ (frontend routes only)
    2. Accept header contains text/markdown or text/x-markdown
    3. Request is anonymous (no authenticated user, no auth token)
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        # Skip API routes - only intercept frontend UI routes
        if request.path.startswith("/api/"):
            return self.get_response(request)

        if not _accepts_markdown(request):
            return self.get_response(request)

        if request.auth is not None or request.user.is_authenticated:
            return self.get_response(request)

        logger.info(
            "ai_agent.guidance_served",
            extra={
                "path": request.path,
                "user_agent": request.META.get("HTTP_USER_AGENT", ""),
            },
        )

        guidance = _build_ai_agent_guidance(request)
        return HttpResponse(guidance, content_type="text/markdown", status=200)
