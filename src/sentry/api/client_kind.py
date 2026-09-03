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

import sentry_sdk
from rest_framework.request import Request
from sentry_conventions.attributes import ATTRIBUTE_NAMES

from sentry import features
from sentry.auth.services.auth import AuthenticatedToken
from sentry.auth.system import is_system_auth
from sentry.middleware import is_frontend_request
from sentry.models.organization import Organization
from sentry.seer.agent_token import is_agent_auth
from sentry.utils.http import SEER_REFERRER_HEADER, get_mcp_client_family, is_mcp_request

FEATURE_FLAG = "organizations:api-client-kind-check"


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
#
# Split by how safe a name is to look for mid-string. A user agent is a sequence of
# `product/version (comment)` tokens and real clients bury the telling one behind a
# prefix -- `python-httpx/0.28.1`, `Python/3.10 aiohttp/3.13.5`,
# `Symfony HttpClient (Curl)`, `Apache-HttpClient/5.5.2 (Java/21.0.10)`. Requiring
# every name to lead the string (as this once did) read all of those as UNKNOWN.
_SCRIPT_USER_AGENT_ANYWHERE = re.compile(
    r"(?:"
    r"curl|wget|urllib3|httpx|aiohttp|node-fetch|axios|undici|okhttp"
    r"|go-http-client|apache-httpclient|libwww-perl|postmanruntime|insomnia"
    r"|guzzlehttp|httparty|faraday|reqwest|scrapy|deno|powershell"
    r"|google-apps-script"
    r")\b",
    re.IGNORECASE,
)

# Names too generic to look for mid-string: `java` is a substring of every
# JavaScript runtime's user agent, and `got`/`requests` are ordinary English words
# that appear in comment tokens. These only count when the caller leads with them.
# `python` covers `python-requests`, `python-urllib` and `python-httpx` alike.
_SCRIPT_USER_AGENT_PREFIX = re.compile(
    r"^(?:node|java|ruby|php|python|requests|got)\b",
    re.IGNORECASE,
)


def get_client_kind(request: Request, organization: Organization) -> ClientKind | None:
    """Classify the caller of an API request.

    Returns ``None`` when the org has not opted in, so that a disabled org is
    distinguishable from one whose traffic genuinely classifies as ``UNKNOWN``.
    Otherwise never raises; unrecognized callers fall back to ``UNKNOWN``.
    """
    if not features.has(FEATURE_FLAG, organization, actor=request.user):
        return None

    auth = getattr(request, "auth", None)
    user = getattr(request, "user", None)
    user_agent = request.META.get("HTTP_USER_AGENT", "")

    # First-party callers first: several of them ride on credentials that would
    # otherwise be classified as an ordinary customer token below.
    if is_system_auth(auth):
        return ClientKind.INTERNAL_SERVICE

    # The first-party MCP server is only identifiable by its user agent today.
    # Checked ahead of Seer, mirroring `resolve_action_source`: an MCP call that also
    # carries a Seer signal is still an MCP call.
    # TODO: derive from the OAuth client_id of the MCP app instead, once MCP
    # traffic reliably carries one -- a user agent is strippable.
    if is_mcp_request(request):
        return ClientKind.MCP

    # Seer reaches us four ways: its own capability token, the viewer context Sentry
    # signed for it (which leaves `request.auth` unset), the referrer header it sets on
    # API calls it makes for a user, or its RPC signature. Keep this list in step with
    # `resolve_action_source` -- the two drifting is what let Seer read as UNKNOWN.
    if (
        is_agent_auth(auth)
        or request.META.get("HTTP_X_VIEWER_CONTEXT")
        or request.META.get(SEER_REFERRER_HEADER)
    ):
        return ClientKind.SEER

    # Imported here, not at module load, to avoid a circular import.
    from sentry.seer.endpoints.seer_rpc import SeerRpcSignatureAuthentication

    if isinstance(
        getattr(request, "successful_authenticator", None), SeerRpcSignatureAuthentication
    ):
        return ClientKind.SEER

    if auth is None:
        # Cookies and no token is the web UI. Share `is_frontend_request` with the
        # `ui_request` tag on `view.response` so the two reconcile; the extra
        # authentication check keeps anonymous cookie-bearing requests out of the bucket.
        if is_frontend_request(request) and getattr(user, "is_authenticated", False):
            return ClientKind.FRONTEND
        return ClientKind.UNKNOWN

    # A SentryApp installation token authenticates as the app's proxy user.
    if getattr(user, "is_sentry_app", False):
        return ClientKind.INTEGRATION
    # A bare OAuth token is *probably* a third-party integration, but a first-party
    # OAuth client acting for a user looks identical here -- the MCP is one, and only
    # avoids this branch because its user agent is checked above. Separating them needs
    # the first-party client_id allowlist this POC does not have yet.
    if isinstance(auth, AuthenticatedToken) and auth.application_id is not None:
        return ClientKind.INTEGRATION

    # What's left is a user token, org auth token or API key. Only the user
    # agent tells those apart, and it can be stripped or forged -- so everything
    # below this line is a medium-confidence guess.
    if _CLI_USER_AGENT.match(user_agent):
        return ClientKind.CLI
    if _SDK_USER_AGENT.match(user_agent):
        return ClientKind.SDK
    if _SCRIPT_USER_AGENT_PREFIX.match(user_agent) or _SCRIPT_USER_AGENT_ANYWHERE.search(
        user_agent
    ):
        return ClientKind.SCRIPT

    return ClientKind.UNKNOWN


def set_client_kind_attributes(request: Request, organization: Organization) -> None:
    """Tag the current transaction with who called the endpoint.

    A no-op when the org has not opted into ``client_kind``. Wired into
    ``OrganizationEventsEndpointBase.convert_args`` so every events endpoint
    reports the same set of attributes without hand-wiring them per handler.
    """
    # `sentry.api.client.ApiClient` dispatches endpoints in-process with a synthetic
    # request that carries no user agent, cookies or token, so it classifies as
    # UNKNOWN. These attributes are isolation-scoped, so recording that would overwrite
    # the enclosing transaction's own classification -- or invent one for a Celery task
    # that never served an API request. The outer caller is the one worth attributing.
    if getattr(request, "__from_api_client__", False):
        return

    client_kind = get_client_kind(request, organization)
    if client_kind is None:
        return

    # `_test` suffix while this is a POC, to keep it out of the way of a
    # real `client_kind` attribute later.
    sentry_sdk.set_tag("client_kind_test", client_kind.value)
    sentry_sdk.set_attribute("client_kind_test", client_kind.value)

    client_host = get_client_host(request)
    if client_host is not None:
        sentry_sdk.set_tag("client_host_test", client_host)
        sentry_sdk.set_attribute("client_host_test", client_host)

    user_agent = get_user_agent(request)
    if user_agent is not None:
        sentry_sdk.set_attribute(ATTRIBUTE_NAMES.USER_AGENT_ORIGINAL, user_agent)


def get_user_agent(request: Request) -> str | None:
    """The raw user agent the caller sent, or None when it sent none.

    Recorded alongside `client_kind` so a bucket can be explained without guessing:
    `unknown` and `script` are only actionable next to the string that produced them.
    Attacker-controlled, like every user agent here -- read it as a hint, not a fact.
    """
    return request.META.get("HTTP_USER_AGENT") or None


def get_client_host(request: Request) -> str | None:
    """The agent host behind an MCP call (`claude-code`, `cursor`, ...), when it declares one.

    Declared rather than derived, so untrusted -- see the doc's trust column. Only the
    first-party MCP server sends it; every other caller yields None.
    """
    return get_mcp_client_family(request)
