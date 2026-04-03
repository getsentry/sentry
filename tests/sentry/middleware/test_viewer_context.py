from __future__ import annotations

from unittest.mock import MagicMock

from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory

from sentry.auth.services.auth import AuthenticatedToken
from sentry.middleware.viewer_context import ViewerContextMiddleware, _viewer_context_from_request
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.viewer_context import ActorType, get_viewer_context


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

    def test_skipped_when_disabled(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        # Default: viewer-context.enabled is False
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
