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
# Sentry

You've hit the web UI. It's HTML meant for humans, not machines.
Here's what you actually want:

## MCP Server (recommended)

The fastest way to give your agent structured access to Sentry.
OAuth-authenticated, HTTP streaming, no HTML parsing required.

```json
{mcp_config_json}
```

Docs: https://mcp.sentry.dev

## CLI

Query issues and analyze errors from the terminal.

https://cli.sentry.dev

## REST API

Full programmatic access when you need it.

```
curl https://sentry.io/api/0/projects/ \\
  -H "Authorization: Bearer <token>"
```

Your human can create a token at https://sentry.io/settings/account/api/auth-tokens/

API reference: https://docs.sentry.io/api/

## Documentation

- **Getting started**: https://docs.sentry.io/platforms/
- **SDKs & setup**: https://docs.sentry.io/platforms/python/, https://docs.sentry.io/platforms/javascript/
- **All docs**: https://docs.sentry.io
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
    1. Request path does NOT start with /api/ or /oauth/ (frontend routes only)
    2. Accept header contains text/markdown or text/x-markdown
    3. Request is anonymous (no authenticated user, no auth token)
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        # Skip API routes - only intercept frontend UI routes
        if request.path.startswith("/api/"):
            return self.get_response(request)

        # Skip OAuth routes - legitimate machine-to-machine endpoints
        if request.path.startswith("/oauth/"):
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
