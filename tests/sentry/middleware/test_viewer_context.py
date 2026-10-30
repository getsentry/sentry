from __future__ import annotations

from typing import cast
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, override_settings
from rest_framework.request import Request

from sentry.auth.services.auth import AuthenticatedToken
from sentry.middleware.auth import AuthenticationMiddleware
from sentry.middleware.viewer_context import ViewerContextMiddleware, _viewer_context_from_request
from sentry.seer import agent_token
from sentry.testutils.cases import TestCase
from sentry.viewer_context import (
    Actor,
    ActorType,
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

        assert ctx.actor.actor_id is None
        assert ctx.organization_id is None
        assert ctx.actor.type is ActorType.UNKNOWN

    def test_session_authenticated_user(self):
        request = self.factory.get("/")
        request.user = self.user
        request.auth = None

        ctx = _viewer_context_from_request(request)

        assert ctx.actor.actor_id == self.user.id
        assert ctx.organization_id is None
        assert ctx.actor.type is ActorType.USER

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

        assert ctx.actor.actor_id == self.user.id
        assert ctx.organization_id == self.organization.id
        assert ctx.actor.type is ActorType.USER
        assert request.auth is token

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

        assert ctx.actor.actor_id is None
        assert ctx.organization_id == self.organization.id
        assert request.auth is token

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

        assert ctx.actor.actor_id == self.user.id
        assert ctx.organization_id is None
        assert request.auth is token


class ViewerContextMiddlewareTest(TestCase):
    def setUp(self):
        super().setUp()
        self.factory = RequestFactory()

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
        assert captured[0].actor.actor_id == self.user.id

    def test_cleans_up_after_request(self):
        middleware = ViewerContextMiddleware(lambda r: MagicMock(status_code=200))

        request = self.factory.get("/")
        request.user = self.user
        request.auth = None

        middleware(request)

        assert get_viewer_context() is None

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
        assert ctx.actor.actor_id is None
        assert ctx.organization_id is None

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
        assert ctx.actor.delegated_user_id == self.user.id
        assert ctx.organization_id == self.organization.id
        assert ctx.actor.type is ActorType.AGENT

    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_jwt_header_sets_viewer_context(self):
        vc = ViewerContext(
            organization_id=self.organization.id,
            actor=Actor(type=ActorType.AGENT, actor_id=90, delegated_user_id=self.user.id),
        )
        token = encode_viewer_context(vc)

        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/", HTTP_X_VIEWER_CONTEXT=token)
        AuthenticationMiddleware(lambda request: MagicMock()).process_request(
            cast(Request, request)
        )

        middleware(request)

        assert captured == [vc]

    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_authenticated_user_takes_precedence_over_jwt(self):
        vc = ViewerContext(actor=Actor(type=ActorType.INTEGRATION), organization_id=99)
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
        assert ctx.actor.actor_id == self.user.id
        assert ctx.actor.type == ActorType.USER

    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_jwt_used_when_no_authenticated_user(self):
        vc = ViewerContext(actor=Actor(type=ActorType.INTEGRATION), organization_id=99)
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
        assert ctx.actor.type == ActorType.INTEGRATION
        assert ctx.actor.actor_id is None

    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    @patch("sentry.middleware.viewer_context.logger")
    def test_logs_warning_on_jwt_request_mismatch(self, mock_logger):
        vc = ViewerContext(actor=Actor(type=ActorType.INTEGRATION), organization_id=99)
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
        assert ctx.actor.actor_id == self.user.id
        assert ctx.actor.type == ActorType.USER

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
        assert ctx.actor.actor_id == self.user.id
        assert ctx.actor.type == ActorType.USER

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
        assert ctx.actor.actor_id is None
        assert ctx.organization_id is None
