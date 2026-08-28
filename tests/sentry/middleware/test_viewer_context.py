from __future__ import annotations

from typing import cast
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, override_settings
from rest_framework.request import Request

from sentry.auth.services.auth import AuthenticatedToken
from sentry.auth.services.service_account import RpcServiceAccount
from sentry.middleware.auth import AuthenticationMiddleware
from sentry.middleware.viewer_context import ViewerContextMiddleware, _viewer_context_from_request
from sentry.seer import agent_token
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.viewer_context import (
    NO_VIEWER_ACTOR,
    ActorType,
    ViewerActor,
    ViewerContext,
    encode_viewer_context,
    get_viewer_context,
)


class ViewerContextFromRequestTest(TestCase):
    def setUp(self):
        super().setUp()
        self.factory = RequestFactory()

    def test_anonymous_request(self):
        request = self.factory.get("/")
        request.user = AnonymousUser()
        request.auth = None

        ctx = _viewer_context_from_request(request)

        assert ctx.user_id is None
        assert ctx.organization_id is None
        assert ctx.actor_type is ActorType.USER
        assert ctx.token is None

    def test_session_authenticated_user(self):
        request = self.factory.get("/")
        request.user = self.user
        request.auth = None

        ctx = _viewer_context_from_request(request)

        assert ctx.user_id == self.user.id
        assert ctx.organization_id is None
        assert ctx.actor_type is ActorType.USER
        assert ctx.token is None

    def test_token_authenticated_user(self):
        request = self.factory.get("/")
        token = AuthenticatedToken(
            allowed_origins=["*"],
            scopes=["org:read"],
            entity_id=1,
            kind="api_token",
            user_id=self.user.id,
            organization_id=self.organization.id,
        )
        request.user = self.user
        request.auth = token

        ctx = _viewer_context_from_request(request)

        assert ctx.user_id == self.user.id
        assert ctx.organization_id == self.organization.id
        assert ctx.actor_type is ActorType.USER
        assert ctx.token is token

    def test_org_scoped_token_without_user(self):
        request = self.factory.get("/")
        request.user = AnonymousUser()
        token = AuthenticatedToken(
            allowed_origins=[],
            scopes=["org:read"],
            entity_id=1,
            kind="org_auth_token",
            organization_id=self.organization.id,
        )
        request.auth = token

        ctx = _viewer_context_from_request(request)

        assert ctx.user_id is None
        assert ctx.organization_id == self.organization.id
        assert ctx.token is token

    def test_token_without_organization(self):
        request = self.factory.get("/")
        token = AuthenticatedToken(
            allowed_origins=[],
            scopes=["org:read"],
            entity_id=1,
            kind="api_token",
            user_id=self.user.id,
        )
        request.user = self.user
        request.auth = token

        ctx = _viewer_context_from_request(request)

        assert ctx.user_id == self.user.id
        assert ctx.organization_id is None
        assert ctx.token is token

    def test_service_account_is_the_typed_actor_not_a_user(self):
        request = self.factory.get("/")
        account = RpcServiceAccount(
            id=123,
            organization_id=self.organization.id,
            name="Deploy bot",
            is_active=True,
        )
        token = AuthenticatedToken(
            scopes=["org:read"],
            entity_id=456,
            kind="api_token",
            organization_id=self.organization.id,
            actor_type="service_account",
            actor_id=account.id,
        )
        request.user = account  # type: ignore[assignment]  # Django's stub excludes auth proxies.
        request.auth = token

        ctx = _viewer_context_from_request(request)

        assert request.user.id == account.id
        assert request.user.is_authenticated
        assert ctx.user_id is None
        assert ctx.actor == ViewerActor(type=ActorType.SERVICE_ACCOUNT, id=account.id)
        assert ctx.actor_type is ActorType.SERVICE_ACCOUNT
        assert ctx.token is token


class ViewerContextMiddlewareTest(TestCase):
    def setUp(self):
        super().setUp()
        self.factory = RequestFactory()

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=False)
    def test_skipped_when_disabled(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/")
        request.user = self.user
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        assert captured[0] is None
        assert request.actor.is_interactive

    @override_settings(
        SENTRY_VIEWER_CONTEXT_ENABLED=True,
        ANONYMOUS_STATIC_PREFIXES=("/static/",),
    )
    def test_static_request_has_anonymous_actor_without_loading_user(self):
        captured: list[ViewerContext | None] = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        request = self.factory.get("/static/app.js")
        ViewerContextMiddleware(get_response)(request)

        assert request.actor is NO_VIEWER_ACTOR
        assert captured == [None]

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    def test_sets_context_during_request(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/")
        request.user = self.user
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        assert captured[0] is not None
        assert captured[0].user_id == self.user.id

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    def test_service_account_auth_populates_request_user_and_viewer_actor(self):
        captured: list[ViewerContext | None] = []

        def get_response(request):
            captured.append(get_viewer_context())
            assert request.user.id == account.id
            assert request.user.get_username() == account.name
            assert request.user.get_full_name() == account.name
            assert request.user.get_display_name() == account.name
            assert str(request.user) == account.name
            assert request.user.email == ""
            assert not request.user.has_usable_password()
            assert not request.user.has_verified_primary_email()
            assert not request.actor.is_interactive
            return MagicMock(status_code=200)

        account = self.create_service_account(
            organization_id=self.organization.id,
            name="Deploy bot",
        )
        self.create_member(
            organization=self.organization,
            service_account_id=account.id,
            role="member",
        )
        token = self.create_service_account_auth_token(account, scope_list=["org:read"])
        bearer = token.plaintext_token
        with assume_test_silo_mode(SiloMode.MONOLITH):
            request = self.factory.get(
                f"/api/0/organizations/{self.organization.slug}/projects/",
                HTTP_AUTHORIZATION=f"Bearer {bearer}",
            )
            AuthenticationMiddleware(lambda r: MagicMock(status_code=200)).process_request(
                cast(Request, request)
            )
            ViewerContextMiddleware(get_response)(request)

        authenticated_user = cast(RpcServiceAccount, request.user)
        authenticated_token = cast(AuthenticatedToken, request.auth)
        assert authenticated_user.id == account.id
        assert authenticated_user.class_name() == "ServiceAccount"
        assert authenticated_token.actor_type == "service_account"
        assert captured[0] is not None
        assert captured[0].actor == ViewerActor(type=ActorType.SERVICE_ACCOUNT, id=account.id)

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    def test_cleans_up_after_request(self):
        middleware = ViewerContextMiddleware(lambda r: MagicMock(status_code=200))

        request = self.factory.get("/")
        request.user = self.user
        request.auth = None

        middleware(request)

        assert get_viewer_context() is None

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    def test_cleans_up_on_exception(self):
        def get_response(request):
            raise RuntimeError("boom")

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/")
        request.user = AnonymousUser()
        request.auth = None

        try:
            middleware(request)
        except RuntimeError:
            pass

        assert get_viewer_context() is None

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    def test_anonymous_request_sets_empty_context(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/")
        request.user = AnonymousUser()
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx is not None
        assert ctx.user_id is None
        assert ctx.organization_id is None
        assert ctx.token is None

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_agent_token_sets_agent_context(self):
        # Through the real chain: AuthenticationMiddleware resolves the agent bearer,
        # then this middleware derives user + org + agent actor from it.
        token, _ = agent_token.encode_agent_token(
            user_id=self.user.id,
            organization_id=self.organization.id,
            scopes=["org:read"],
            session_id="s1",
        )

        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        request = self.factory.get("/api/0/organizations/", HTTP_AUTHORIZATION=f"Bearer {token}")
        with self.feature(agent_token.FEATURE_FLAG):
            AuthenticationMiddleware(lambda r: MagicMock(status_code=200)).process_request(
                cast(Request, request)
            )
        ViewerContextMiddleware(get_response)(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx is not None
        assert ctx.user_id == self.user.id
        assert ctx.organization_id == self.organization.id
        assert ctx.actor_type is ActorType.AGENT
        assert ctx.token is not None

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_jwt_header_sets_viewer_context(self):
        vc = ViewerContext(organization_id=42, user_id=7, actor_type=ActorType.INTEGRATION)
        token = encode_viewer_context(vc)

        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/", HTTP_X_VIEWER_CONTEXT=token)
        request.user = AnonymousUser()
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx is not None
        assert ctx.organization_id == 42
        assert ctx.user_id == 7
        assert ctx.actor_type == ActorType.INTEGRATION

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_authenticated_user_takes_precedence_over_jwt(self):
        vc = ViewerContext(organization_id=99, actor_type=ActorType.INTEGRATION)
        token = encode_viewer_context(vc)

        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/", HTTP_X_VIEWER_CONTEXT=token)
        request.user = self.user
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx.user_id == self.user.id
        assert ctx.actor_type == ActorType.USER

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_agent_auth_takes_precedence_over_jwt_without_actor_id(self):
        jwt = encode_viewer_context(
            ViewerContext(organization_id=99, actor_type=ActorType.INTEGRATION)
        )
        captured: list[ViewerContext | None] = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        request = self.factory.get("/", HTTP_X_VIEWER_CONTEXT=jwt)
        request.user = AnonymousUser()
        request.auth = AuthenticatedToken(
            kind=agent_token.AGENT_TOKEN_KIND,
            scopes=["org:read"],
            user_id=self.user.id,
            organization_id=self.organization.id,
        )

        ViewerContextMiddleware(get_response)(request)

        assert captured[0] is not None
        assert captured[0].actor_type is ActorType.AGENT
        assert captured[0].user_id == self.user.id
        assert captured[0].organization_id == self.organization.id

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_jwt_used_when_no_authenticated_user(self):
        vc = ViewerContext(organization_id=99, actor_type=ActorType.INTEGRATION)
        token = encode_viewer_context(vc)

        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/", HTTP_X_VIEWER_CONTEXT=token)
        request.user = AnonymousUser()
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx.organization_id == 99
        assert ctx.actor_type == ActorType.INTEGRATION
        assert ctx.user_id is None

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    @patch("sentry.middleware.viewer_context.logger")
    def test_logs_warning_on_jwt_request_mismatch(self, mock_logger):
        vc = ViewerContext(organization_id=99, actor_type=ActorType.INTEGRATION)
        token = encode_viewer_context(vc)

        middleware = ViewerContextMiddleware(lambda r: MagicMock(status_code=200))

        token_auth = AuthenticatedToken(
            allowed_origins=[],
            scopes=["org:read"],
            entity_id=1,
            kind="org_auth_token",
            organization_id=self.organization.id,
        )
        request = self.factory.get("/", HTTP_X_VIEWER_CONTEXT=token)
        request.user = self.user
        request.auth = token_auth

        middleware(request)

        mock_logger.error.assert_called_once_with(
            "viewer_context.jwt_request_mismatch",
            extra={
                "jwt_org_id": 99,
                "request_org_id": self.organization.id,
            },
        )

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_invalid_jwt_falls_back_to_request_user(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/", HTTP_X_VIEWER_CONTEXT="invalid.jwt.token")
        request.user = self.user
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx.user_id == self.user.id
        assert ctx.actor_type == ActorType.USER

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    def test_raw_json_without_signature_falls_back(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get(
            "/",
            HTTP_X_VIEWER_CONTEXT='{"actor_type": "integration", "organization_id": 42}',
        )
        request.user = self.user
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx.user_id == self.user.id
        assert ctx.actor_type == ActorType.USER

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_non_jwt_header_ignored(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get(
            "/",
            HTTP_X_VIEWER_CONTEXT='{"actor_type": "integration", "organization_id": 42}',
        )
        request.user = AnonymousUser()
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx.user_id is None
        assert ctx.organization_id is None
