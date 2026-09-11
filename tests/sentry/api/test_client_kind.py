from types import SimpleNamespace
from typing import Any
from unittest import mock

import pytest
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory
from sentry_conventions.attributes import ATTRIBUTE_NAMES

from sentry.api.client_kind import (
    ATTRIBUTION_SPAN_OP,
    FEATURE_FLAG,
    ClientKind,
    client_kind_scope,
    get_client_host,
    get_client_kind,
    get_user_agent,
    set_client_kind_attributes,
)
from sentry.auth.services.auth import AuthenticatedToken
from sentry.auth.system import SystemToken
from sentry.seer.agent_token import AGENT_TOKEN_KIND
from sentry.seer.endpoints.seer_rpc import SeerRpcSignatureAuthentication
from sentry.testutils.cases import APITestCase, TestCase
from sentry.utils.sdk import get_transaction_name_from_request

EVENTS_PATH = "/api/0/organizations/my-org/events/"
EVENTS_ROUTE = "/api/0/organizations/{organization_id_or_slug}/events/"


def make_request(
    *,
    auth: Any = None,
    user: Any = None,
    user_agent: str | None = None,
    headers: dict[str, str] | None = None,
    cookies: bool = True,
    path: str = EVENTS_PATH,
) -> Request:
    request = Request(RequestFactory().get(path, headers=headers or {}))
    if user_agent is not None:
        request.META["HTTP_USER_AGENT"] = user_agent
    if cookies:
        request._request.COOKIES["sentrysid"] = "x"
    # Assigning both short-circuits the lazy authentication the getters would
    # otherwise run, so the request arrives pre-authenticated.
    request.user = user if user is not None else AnonymousUser()
    request.auth = auth
    return request


def mark_from_api_client(request: Request) -> None:
    """Stamp the marker `sentry.api.client.ApiClient` puts on its synthetic requests.

    Set on the underlying Django request, as `ApiClient` does; the DRF request
    delegates the lookup, which is what the guard in `client_kind` relies on.
    """
    django_request: Any = request._request
    django_request.__from_api_client__ = True


def mark_authenticated_by(request: Request, authenticator: object) -> None:
    """Record the authenticator DRF would have selected.

    `successful_authenticator` is a read-only property over `_authenticator`, so
    tests that exercise credential-based branches have to set the backing attribute.
    """
    drf_request: Any = request
    drf_request._authenticator = authenticator


def session_user(*, is_sentry_app: bool = False) -> SimpleNamespace:
    return SimpleNamespace(is_authenticated=True, is_sentry_app=is_sentry_app)


def api_token(*, application_id: int | None = None) -> AuthenticatedToken:
    return AuthenticatedToken(kind="api_token", user_id=1, application_id=application_id)


class GetClientKindTest(TestCase):
    def classify(self, request: Request) -> ClientKind:
        return get_client_kind(request)

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

    def test_seer_signals_outrank_seers_own_script_like_user_agent(self) -> None:
        # Seer calls Sentry with `python-httpx`, which the script rules match. Every
        # Seer branch is checked before the user-agent rules, so widening those must
        # not reclassify Seer as SCRIPT -- the bucket is only reached on a fall-through.
        user_agent = "python-httpx/0.28.1"
        assert self.classify(make_request(auth=api_token(), user_agent=user_agent)) == (
            ClientKind.SCRIPT
        )

        rpc_signature = make_request(auth=api_token(), user_agent=user_agent)
        mark_authenticated_by(rpc_signature, SeerRpcSignatureAuthentication())
        cases = [
            (
                "seer referrer",
                make_request(
                    auth=api_token(),
                    user_agent=user_agent,
                    headers={"X-Seer-Referrer": "explorer"},
                ),
            ),
            (
                "viewer context",
                make_request(
                    auth=api_token(), user_agent=user_agent, headers={"X-Viewer-Context": "a.b.c"}
                ),
            ),
            (
                "agent token",
                make_request(
                    auth=AuthenticatedToken(kind=AGENT_TOKEN_KIND, user_id=1, organization_id=1),
                    user_agent=user_agent,
                ),
            ),
            ("rpc signature", rpc_signature),
        ]
        for signal, request in cases:
            with self.subTest(signal=signal):
                assert self.classify(request) == ClientKind.SEER

    def test_tool_name_is_found_after_a_prefix(self) -> None:
        # Real clients bury the telling token behind a prefix or inside a comment.
        # Requiring it to lead the string read every one of these as UNKNOWN.
        cases = [
            "node",
            "python-httpx/0.28.1",
            "Python/3.10 aiohttp/3.13.5",
            "Apache-HttpClient/5.5.2 (Java/21.0.10)",
            "Symfony HttpClient (Curl)",
            "Deno/2.1.4 (variant; SupabaseEdgeRuntime/1.74.4)",
            "Mozilla/5.0 (compatible; Google-Apps-Script; beanserver; +https://script.google.com)",
            "Mozilla/5.0 (Windows NT; Windows NT 10.0; en-GB) WindowsPowerShell/5.1.20348",
        ]
        for user_agent in cases:
            with self.subTest(user_agent=user_agent):
                request = make_request(auth=api_token(), user_agent=user_agent)
                assert self.classify(request) == ClientKind.SCRIPT

    def test_browsers_are_not_mistaken_for_scripts(self) -> None:
        # The cost of matching mid-string is false positives, so the generic names
        # (`java` inside `JavaScript`, `got`, `requests`) stay anchored to the front.
        cases = [
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
            "AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
            "JavaScript/1.0",
        ]
        for user_agent in cases:
            with self.subTest(user_agent=user_agent):
                request = make_request(auth=api_token(), user_agent=user_agent)
                assert self.classify(request) == ClientKind.UNKNOWN

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
    def test_records_kind_and_user_agent(self) -> None:
        request = make_request(auth=api_token(), user_agent="curl/8.7.1")
        with (
            mock.patch("sentry.api.client_kind.sentry_sdk") as sdk,
        ):
            set_client_kind_attributes(request)
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
            mock.patch("sentry.api.client_kind.sentry_sdk") as sdk,
        ):
            set_client_kind_attributes(request)
        assert mock.call("client_host_test", "claude-code") in sdk.set_tag.call_args_list
        assert mock.call("client_host_test", "claude-code") in sdk.set_attribute.call_args_list

    def test_omits_user_agent_when_absent(self) -> None:
        request = make_request(auth=api_token())
        with (
            mock.patch("sentry.api.client_kind.sentry_sdk") as sdk,
        ):
            set_client_kind_attributes(request)
        for call in sdk.set_attribute.call_args_list:
            assert call.args[0] != ATTRIBUTE_NAMES.USER_AGENT_ORIGINAL

    def test_records_for_the_internal_api_client_too(self) -> None:
        # These attributes are isolation-scoped, so a nested `ApiClient` dispatch writes
        # onto its caller's transaction. That is what lets an entrypoint declare a kind
        # its nested dispatches cannot derive for themselves.
        request = make_request(auth=api_token(), user_agent="curl/8.7.1")
        mark_from_api_client(request)
        with (
            mock.patch("sentry.api.client_kind.sentry_sdk") as sdk,
            mock.patch("sentry.api.client_kind.start_span"),
        ):
            set_client_kind_attributes(request)
        assert sdk.set_tag.call_args_list == [mock.call("client_kind_test", "script")]


class AccessLogAttributesTest(TestCase):
    """Asserted on the underlying Django request, which is all `access_log` sees."""

    def stored(self, request: Request) -> tuple[Any, Any]:
        django_request: Any = request._request
        return (
            getattr(django_request, "client_kind", None),
            getattr(django_request, "client_host", None),
        )

    def test_stores_the_derived_kind(self) -> None:
        request = make_request(auth=api_token(), user_agent="curl/8.7.1")
        set_client_kind_attributes(request)
        assert self.stored(request) == (ClientKind.SCRIPT, None)

    def test_stores_the_client_host_for_mcp(self) -> None:
        request = make_request(
            auth=api_token(),
            user_agent="sentry-mcp/1.0",
            headers={
                "X-Sentry-MCP-Version": "1.0",
                "X-Sentry-MCP-Client-Family": "Claude-Code",
            },
        )
        set_client_kind_attributes(request)
        assert self.stored(request) == (ClientKind.MCP, "claude-code")

    def test_absent_until_dispatch_runs(self) -> None:
        # An un-attributed request leaves the attributes absent, not empty.
        assert self.stored(make_request(auth=api_token())) == (None, None)


class AttributionSpanTest(TestCase):
    def record(self, request: Request) -> tuple[Any, list[tuple[str, Any]]]:
        with (
            mock.patch("sentry.api.client_kind.start_span") as start_span,
            mock.patch("sentry.api.client_kind.set_span_data") as set_span_data,
        ):
            set_client_kind_attributes(request)
        span = start_span.return_value.__enter__.return_value
        return start_span, [
            call.args[1:] for call in set_span_data.call_args_list if call.args[0] is span
        ]

    def test_pairs_the_route_with_the_caller(self) -> None:
        start_span, attributes = self.record(
            make_request(auth=api_token(), user_agent="curl/8.7.1")
        )
        assert start_span.call_args == mock.call(op=ATTRIBUTION_SPAN_OP, name=EVENTS_ROUTE)
        assert attributes == [
            (ATTRIBUTE_NAMES.HTTP_ROUTE, EVENTS_ROUTE),
            ("client_kind_test", "script"),
            (ATTRIBUTE_NAMES.USER_AGENT_ORIGINAL, "curl/8.7.1"),
        ]

    def test_records_the_route_for_an_internal_api_client_dispatch(self) -> None:
        request = make_request(auth=api_token(), user_agent="curl/8.7.1")
        mark_from_api_client(request)
        start_span, attributes = self.record(request)
        assert start_span.call_args == mock.call(op=ATTRIBUTION_SPAN_OP, name=EVENTS_ROUTE)
        assert (ATTRIBUTE_NAMES.HTTP_ROUTE, EVENTS_ROUTE) in attributes

    def test_carries_the_mcp_client_host(self) -> None:
        _, attributes = self.record(
            make_request(
                auth=api_token(),
                user_agent="sentry-mcp/1.0",
                headers={
                    "X-Sentry-MCP-Version": "1.0",
                    "X-Sentry-MCP-Client-Family": "Claude-Code",
                },
            )
        )
        assert ("client_host_test", "claude-code") in attributes

    def test_omits_user_agent_when_absent(self) -> None:
        _, attributes = self.record(make_request(auth=api_token()))
        assert [key for key, _ in attributes] == [
            ATTRIBUTE_NAMES.HTTP_ROUTE,
            "client_kind_test",
        ]


class SpanRouteTest(TestCase):
    """Pin the route resolution `_record_attribution_span` names its span with."""

    def test_parameterizes_the_url(self) -> None:
        assert get_transaction_name_from_request(make_request()) == EVENTS_ROUTE

    def test_an_internal_dispatch_resolves_to_the_same_route(self) -> None:
        mock_request = APIRequestFactory().get(EVENTS_PATH, {})
        request = Request(mock_request)
        request.user = AnonymousUser()
        assert get_transaction_name_from_request(request) == EVENTS_ROUTE

    def test_an_unmatched_path_collapses_onto_a_catch_all(self) -> None:
        request = make_request(path="/api/0/definitely/not/a/route/")
        assert get_transaction_name_from_request(request) == "/api/0/"


class ClientKindScopeTest(TestCase):
    def classify(self, request: Request) -> ClientKind:
        return get_client_kind(request)

    def test_declared_kind_wins_over_a_signal_less_request(self) -> None:
        request = make_request(cookies=False)
        assert self.classify(request) == ClientKind.UNKNOWN
        with client_kind_scope(ClientKind.SEER):
            assert self.classify(request) == ClientKind.SEER

    def test_declared_kind_wins_over_a_derived_one(self) -> None:
        request = make_request(auth=api_token(), user_agent="curl/8.7.1")
        assert self.classify(request) == ClientKind.SCRIPT
        with client_kind_scope(ClientKind.SEER):
            assert self.classify(request) == ClientKind.SEER

    def test_scope_is_restored_on_exit(self) -> None:
        request = make_request(cookies=False)
        with client_kind_scope(ClientKind.SEER):
            pass
        assert self.classify(request) == ClientKind.UNKNOWN

    def test_scope_is_restored_when_the_block_raises(self) -> None:
        request = make_request(cookies=False)
        with pytest.raises(ValueError):
            with client_kind_scope(ClientKind.SEER):
                raise ValueError
        assert self.classify(request) == ClientKind.UNKNOWN

    def test_nested_scopes_restore_the_outer_kind(self) -> None:
        request = make_request(cookies=False)
        with client_kind_scope(ClientKind.SEER):
            with client_kind_scope(ClientKind.MCP):
                assert self.classify(request) == ClientKind.MCP
            assert self.classify(request) == ClientKind.SEER

    def test_declared_kind_is_recorded(self) -> None:
        request = make_request(cookies=False)
        with (
            client_kind_scope(ClientKind.SEER),
            mock.patch("sentry.api.client_kind.sentry_sdk") as sdk,
        ):
            set_client_kind_attributes(request)
        assert sdk.set_tag.call_args_list == [mock.call("client_kind_test", "seer")]
        assert mock.call("client_kind_test", "seer") in sdk.set_attribute.call_args_list


class DispatchWiringTest(APITestCase):
    """Coverage reaches endpoints beyond the events base this started on.

    Driven through real requests rather than a resolver seam: `Endpoint.dispatch`
    reads the organization straight off `kwargs`/`request`, so the only honest way
    to pin which endpoint families are covered is to call them.
    """

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def tags_for(self, url: str, *, enabled: bool = True) -> list[Any]:
        with (
            self.feature(FEATURE_FLAG if enabled else {FEATURE_FLAG: False}),
            mock.patch("sentry.api.client_kind.sentry_sdk") as sdk,
        ):
            assert self.client.get(url).status_code == 200
        return sdk.set_tag.call_args_list

    def test_an_organization_endpoint_records_the_caller(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/"
        assert mock.call("client_kind_test", "frontend") in self.tags_for(url)

    def test_a_project_endpoint_records_the_caller(self) -> None:
        url = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/"
        assert mock.call("client_kind_test", "frontend") in self.tags_for(url)

    def test_a_team_endpoint_records_the_caller(self) -> None:
        url = f"/api/0/teams/{self.organization.slug}/{self.team.slug}/"
        assert mock.call("client_kind_test", "frontend") in self.tags_for(url)

    def test_an_issue_endpoint_records_the_caller(self) -> None:
        # Team and issue endpoints resolve their organization off the related object
        # rather than into an `organization` kwarg, so they are the families most
        # likely to silently fall out of coverage.
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/"
        assert mock.call("client_kind_test", "frontend") in self.tags_for(url)

    def test_records_nothing_when_the_organization_has_not_opted_in(self) -> None:
        url = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/"
        assert self.tags_for(url, enabled=False) == []

    def test_a_declared_kind_does_not_bypass_the_opt_in(self) -> None:
        """A declared caller must not also grant the organization's opt-in.

        The opt-in check moved out of `get_client_kind` and up to the dispatch call
        site, so it is the ordering there -- not the function -- that now keeps a
        `client_kind_scope` declaration from reporting for an org that never enabled
        the feature.
        """
        url = f"/api/0/projects/{self.organization.slug}/{self.project.slug}/"
        with client_kind_scope(ClientKind.SEER):
            assert self.tags_for(url, enabled=False) == []
