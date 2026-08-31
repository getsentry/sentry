"""Derive *who* called the API, as opposed to *what code path served it*.

``client_kind`` is derived at the edge from the credential, the transport and the
user agent -- never from a client-declared query param -- so it stays meaningful
for clients that lie and for clients that never upgrade. It is deliberately not
the same thing as ``referrer``, which names the code path that served a request.

See https://linear.app/getsentry/document/how-to-track-api-usage-df929656b848
"""

from __future__ import annotations

import re
from enum import StrEnum

from rest_framework.request import Request

from sentry.auth.services.auth import AuthenticatedToken
from sentry.auth.system import is_system_auth
from sentry.seer.agent_token import is_agent_auth
from sentry.utils.http import is_mcp_request


class ClientKind(StrEnum):
    FRONTEND = "frontend"
    SEER = "seer"
    INTERNAL_SERVICE = "internal_service"
    MCP = "mcp"
    INTEGRATION = "integration"
    CLI = "cli"
    SDK = "sdk"
    SCRIPT = "script"
    UNKNOWN = "unknown"


# `sentry-cli/2.42.1`. Checked before the SDK pattern, which it also matches.
_CLI_USER_AGENT = re.compile(r"^sentry-cli/", re.IGNORECASE)

# `sentry.python/2.19.0`, `sentry-ruby/5.22.1`, ... SDKs calling the web API,
# which is a different thing from an SDK submitting events to ingest.
_SDK_USER_AGENT = re.compile(r"^sentry[.-][a-z0-9_.-]+/", re.IGNORECASE)

# Generic HTTP clients: someone's automation, not a Sentry-authored client. A
# coding agent hitting the API directly lands here too -- nothing in the request
# separates it from any other script, so we don't pretend to detect `agent`.
_SCRIPT_USER_AGENT = re.compile(
    r"^(?:"
    r"curl|wget|python-requests|python-urllib|urllib3|httpx|aiohttp|requests"
    r"|node-fetch|axios|got|undici|okhttp|go-http-client|java|libwww-perl"
    r"|postmanruntime|insomnia|ruby|php|guzzlehttp|httparty|faraday|reqwest"
    r")\b",
    re.IGNORECASE,
)


def get_client_kind(request: Request) -> ClientKind:
    """Classify the caller of an API request. Never raises; falls back to UNKNOWN."""
    auth = getattr(request, "auth", None)
    user = getattr(request, "user", None)
    user_agent = request.META.get("HTTP_USER_AGENT", "")

    # First-party callers first: several of them ride on credentials that would
    # otherwise be classified as an ordinary customer token below.
    if is_system_auth(auth):
        return ClientKind.INTERNAL_SERVICE

    # Seer reaches us two ways: its own capability token, or by echoing back the
    # viewer context Sentry signed for it (which leaves `request.auth` unset).
    if is_agent_auth(auth) or request.META.get("HTTP_X_VIEWER_CONTEXT"):
        return ClientKind.SEER

    # The first-party MCP server is only identifiable by its user agent today.
    # TODO: derive from the OAuth client_id of the MCP app instead, once MCP
    # traffic reliably carries one -- a user agent is strippable.
    if is_mcp_request(request):
        return ClientKind.MCP

    if auth is None:
        # Session cookie: the web UI, or an unauthenticated request.
        return (
            ClientKind.FRONTEND if getattr(user, "is_authenticated", False) else ClientKind.UNKNOWN
        )

    # A SentryApp installation token authenticates as the app's proxy user; an
    # OAuth token carries the third-party application that minted it.
    if getattr(user, "is_sentry_app", False):
        return ClientKind.INTEGRATION
    if isinstance(auth, AuthenticatedToken) and auth.application_id is not None:
        return ClientKind.INTEGRATION

    # What's left is a user token, org auth token or API key. Only the user
    # agent tells those apart, and it can be stripped or forged -- so everything
    # below this line is a medium-confidence guess.
    if _CLI_USER_AGENT.match(user_agent):
        return ClientKind.CLI
    if _SDK_USER_AGENT.match(user_agent):
        return ClientKind.SDK
    if _SCRIPT_USER_AGENT.match(user_agent):
        return ClientKind.SCRIPT

    return ClientKind.UNKNOWN
