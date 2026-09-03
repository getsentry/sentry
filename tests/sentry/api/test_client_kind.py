from types import SimpleNamespace
from typing import Any
from unittest import mock

from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory
from rest_framework.request import Request
from sentry_conventions.attributes import ATTRIBUTE_NAMES

from sentry.api.client_kind import (
    FEATURE_FLAG,
    ClientKind,
    get_client_host,
    get_client_kind,
    get_user_agent,
    set_client_kind_attributes,
)
from sentry.auth.services.auth import AuthenticatedToken
from sentry.auth.system import SystemToken
from sentry.seer.agent_token import AGENT_TOKEN_KIND
from sentry.testutils.cases import TestCase


def make_request(
    *,
    auth: Any = None,
    user: Any = None,
    user_agent: str | None = None,
    headers: dict[str, str] | None = None,
    cookies: bool = True,
) -> Request:
    request = Request(RequestFactory().get("/", headers=headers or {}))
    if user_agent is not None:
        request.META["HTTP_USER_AGENT"] = user_agent
    if cookies:
        request._request.COOKIES["sentrysid"] = "x"
    # Assigning both short-circuits the lazy authentication the getters would
    # otherwise run, so the request arrives pre-authenticated.
    request.user = user if user is not None else AnonymousUser()
    request.auth = auth
    return request


def session_user(*, is_sentry_app: bool = False) -> SimpleNamespace:
    return SimpleNamespace(is_authenticated=True, is_sentry_app=is_sentry_app)


def api_token(*, application_id: int | None = None) -> AuthenticatedToken:
    return AuthenticatedToken(kind="api_token", user_id=1, application_id=application_id)


class GetClientKindTest(TestCase):
    def classify(self, request: Request) -> ClientKind | None:
        with self.feature(FEATURE_FLAG):
            return get_client_kind(request, self.organization)

    def test_returns_none_when_feature_is_disabled(self) -> None:
        # A disabled org has to stay distinguishable from one that classifies as UNKNOWN.
        with self.feature({FEATURE_FLAG: False}):
            assert get_client_kind(make_request(), self.organization) is None

    def test_session_auth_is_frontend(self) -> None:
        assert self.classify(make_request(user=session_user())) == ClientKind.FRONTEND

    def test_anonymous_is_unknown(self) -> None:
        assert self.classify(make_request()) == ClientKind.UNKNOWN

    def test_system_auth_is_internal_service(self) -> None:
        auth = AuthenticatedToken.from_token(SystemToken())
        assert self.classify(make_request(auth=auth)) == ClientKind.INTERNAL_SERVICE

    def test_agent_token_is_seer(self) -> None:
        auth = AuthenticatedToken(kind=AGENT_TOKEN_KIND, user_id=1, organization_id=1)
        assert self.classify(make_request(auth=auth)) == ClientKind.SEER

    def test_viewer_context_header_is_seer(self) -> None:
        # Seer echoes back the viewer context Sentry signed, which leaves auth unset.
        request = make_request(user=session_user(), headers={"X-Viewer-Context": "a.b.c"})
        assert self.classify(request) == ClientKind.SEER

    def test_seer_referrer_header_is_seer(self) -> None:
        # Seer sets this on API calls it makes for a user; without it those calls
        # carry an ordinary user token and used to read as UNKNOWN.
        request = make_request(auth=api_token(), headers={"X-Seer-Referrer": "explorer"})
        assert self.classify(request) == ClientKind.SEER

    def test_mcp_wins_over_a_seer_signal(self) -> None:
        # Priority matches `resolve_action_source`: MCP is checked before Seer.
        request = make_request(
            auth=api_token(application_id=42),
            user_agent="sentry-mcp/0.35.0 (https://mcp.sentry.dev)",
            headers={"X-Seer-Referrer": "explorer"},
        )
        assert self.classify(request) == ClientKind.MCP

    def test_mcp_user_agent_wins_over_the_oauth_token_it_carries(self) -> None:
        # MCP authenticates via OAuth, so its token would otherwise read as INTEGRATION.
        request = make_request(
            auth=api_token(application_id=42),
            user_agent="sentry-mcp/0.35.0 (https://mcp.sentry.dev)",
        )
        assert self.classify(request) == ClientKind.MCP

    def test_sentry_app_token_is_integration(self) -> None:
        request = make_request(auth=api_token(), user=session_user(is_sentry_app=True))
        assert self.classify(request) == ClientKind.INTEGRATION

    def test_oauth_token_is_integration(self) -> None:
        request = make_request(auth=api_token(application_id=42))
        assert self.classify(request) == ClientKind.INTEGRATION

    def test_token_auth_falls_back_to_user_agent(self) -> None:
        cases = [
            ("sentry-cli/2.42.1", ClientKind.CLI),
            ("sentry.python/2.19.0", ClientKind.SDK),
            ("sentry-ruby/5.22.1", ClientKind.SDK),
            ("python-requests/2.31.0", ClientKind.SCRIPT),
            ("curl/8.7.1", ClientKind.SCRIPT),
            ("node-fetch/1.0", ClientKind.SCRIPT),
            ("", ClientKind.UNKNOWN),
            ("something-bespoke/1.0", ClientKind.UNKNOWN),
        ]
        for user_agent, expected in cases:
            with self.subTest(user_agent=user_agent):
                request = make_request(auth=api_token(), user_agent=user_agent)
                assert self.classify(request) == expected

    def test_frontend_requires_a_session_cookie(self) -> None:
        # Shares `is_frontend_request` with the `ui_request` tag on `view.response`.
        request = make_request(user=session_user(), cookies=False)
        assert self.classify(request) == ClientKind.UNKNOWN


class GetUserAgentTest(TestCase):
    def test_returns_the_raw_user_agent(self) -> None:
        assert get_user_agent(make_request(user_agent="curl/8.7.1")) == "curl/8.7.1"

    def test_absent_user_agent_is_none(self) -> None:
        assert get_user_agent(make_request()) is None

    def test_empty_user_agent_is_none(self) -> None:
        # An empty header and no header at all mean the same thing to a reader.
        assert get_user_agent(make_request(user_agent="")) is None


class GetClientHostTest(TestCase):
    def test_mcp_client_family(self) -> None:
        request = make_request(headers={"X-Sentry-MCP-Client-Family": "Claude-Code"})
        assert get_client_host(request) == "claude-code"

    def test_catchall_family_is_none(self) -> None:
        request = make_request(headers={"X-Sentry-MCP-Client-Family": "unknown"})
        assert get_client_host(request) is None

    def test_absent_header_is_none(self) -> None:
        assert get_client_host(make_request()) is None


class SetClientKindAttributesTest(TestCase):
    def test_noop_when_feature_is_disabled(self) -> None:
        request = make_request(auth=api_token(), user_agent="curl/8.7.1")
        with (
            self.feature({FEATURE_FLAG: False}),
            mock.patch("sentry.api.client_kind.sentry_sdk") as sdk,
        ):
            set_client_kind_attributes(request, self.organization)
        sdk.set_tag.assert_not_called()
        sdk.set_attribute.assert_not_called()

    def test_records_kind_and_user_agent(self) -> None:
        request = make_request(auth=api_token(), user_agent="curl/8.7.1")
        with (
            self.feature(FEATURE_FLAG),
            mock.patch("sentry.api.client_kind.sentry_sdk") as sdk,
        ):
            set_client_kind_attributes(request, self.organization)
        assert sdk.set_tag.call_args_list == [mock.call("client_kind_test", "script")]
        assert sdk.set_attribute.call_args_list == [
            mock.call("client_kind_test", "script"),
            mock.call(ATTRIBUTE_NAMES.USER_AGENT_ORIGINAL, "curl/8.7.1"),
        ]

    def test_records_client_host_for_mcp(self) -> None:
        request = make_request(
            auth=api_token(),
            user_agent="sentry-mcp/1.0",
            headers={
                "X-Sentry-MCP-Version": "1.0",
                "X-Sentry-MCP-Client-Family": "Claude-Code",
            },
        )
        with (
            self.feature(FEATURE_FLAG),
            mock.patch("sentry.api.client_kind.sentry_sdk") as sdk,
        ):
            set_client_kind_attributes(request, self.organization)
        assert mock.call("client_host_test", "claude-code") in sdk.set_tag.call_args_list
        assert mock.call("client_host_test", "claude-code") in sdk.set_attribute.call_args_list

    def test_omits_user_agent_when_absent(self) -> None:
        request = make_request(auth=api_token())
        with (
            self.feature(FEATURE_FLAG),
            mock.patch("sentry.api.client_kind.sentry_sdk") as sdk,
        ):
            set_client_kind_attributes(request, self.organization)
        for call in sdk.set_attribute.call_args_list:
            assert call.args[0] != ATTRIBUTE_NAMES.USER_AGENT_ORIGINAL
