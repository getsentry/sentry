from __future__ import annotations

from unittest.mock import MagicMock, patch

from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, override_settings

from sentry.auth.services.auth import AuthenticatedToken
from sentry.middleware.viewer_context import ViewerContextMiddleware, _viewer_context_from_request
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.viewer_context import (
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


class ViewerContextMiddlewareTest(TestCase):
    def setUp(self):
        super().setUp()
        self.factory = RequestFactory()

    @override_options({"viewer-context.enabled": False})
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

    @override_options({"viewer-context.enabled": True})
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

    @override_options({"viewer-context.enabled": True})
    def test_cleans_up_after_request(self):
        middleware = ViewerContextMiddleware(lambda r: MagicMock(status_code=200))

        request = self.factory.get("/")
        request.user = self.user
        request.auth = None

        middleware(request)

        assert get_viewer_context() is None

    @override_options({"viewer-context.enabled": True})
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

    @override_options({"viewer-context.enabled": True})
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

    @override_options({"viewer-context.enabled": True})
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

    @override_options({"viewer-context.enabled": True})
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

    @override_options({"viewer-context.enabled": True})
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

    @override_options({"viewer-context.enabled": True})
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

    @override_options({"viewer-context.enabled": True})
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

    @override_options({"viewer-context.enabled": True})
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

    @override_options({"viewer-context.enabled": True})
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_legacy_hmac_header_sets_viewer_context(self):
        import hashlib
        import hmac

        import orjson

        context_data = {"actor_type": "integration", "organization_id": 42}
        context_bytes = orjson.dumps(context_data)
        signature = hmac.new(b"test-secret", context_bytes, hashlib.sha256).hexdigest()

        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get(
            "/",
            HTTP_X_VIEWER_CONTEXT=context_bytes.decode("utf-8"),
            HTTP_X_VIEWER_CONTEXT_SIGNATURE=signature,
        )
        request.user = AnonymousUser()
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx.organization_id == 42
        assert ctx.actor_type == ActorType.INTEGRATION

    @override_options({"viewer-context.enabled": True})
    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_legacy_hmac_bad_signature_ignored(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get(
            "/",
            HTTP_X_VIEWER_CONTEXT='{"actor_type": "integration", "organization_id": 42}',
            HTTP_X_VIEWER_CONTEXT_SIGNATURE="bad-signature",
        )
        request.user = AnonymousUser()
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx.user_id is None
        assert ctx.organization_id is None
