import ast
from collections.abc import Callable
from pathlib import Path
from typing import Any
from unittest import mock

import pytest
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory
from django.utils.functional import SimpleLazyObject
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import NotAuthenticated
from rest_framework.request import Request

from sentry.api.exceptions import UserRequired
from sentry.auth import principal
from sentry.auth.principal import (
    RequestPrincipal,
    acting_user_id,
    has_user,
    require_user,
    resolve_actor,
    set_request_principal,
)
from sentry.auth.services.auth import AuthenticatedToken
from sentry.service_accounts.principal import ServiceAccountPrincipal
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test
from sentry.users.models.user import User
from sentry.users.services.user.serial import serialize_rpc_user
from sentry.viewer_context import (
    Actor,
    ActorType,
    SuperuserAccess,
    ViewerContext,
    get_viewer_context,
    viewer_context_scope,
)


@all_silo_test
class RequestPrincipalTest(TestCase):
    def test_user(self) -> None:
        principal: RequestPrincipal = self.user
        assert acting_user_id(principal) == self.user.id

    def test_rpc_user(self) -> None:
        principal: RequestPrincipal = serialize_rpc_user(self.user)
        assert acting_user_id(principal) == self.user.id

    def test_anonymous(self) -> None:
        principal: RequestPrincipal = AnonymousUser()
        assert acting_user_id(principal) is None
        assert not principal.is_sentry_app
        assert principal.get_display_name() == ""


@all_silo_test
class HasUserTest(TestCase):
    def test_user(self) -> None:
        assert has_user(self.user)
        assert has_user(serialize_rpc_user(self.user))

    def test_anonymous(self) -> None:
        assert not has_user(AnonymousUser())


@all_silo_test
class ResolveActorTest(TestCase):
    def test_user(self) -> None:
        assert resolve_actor(self.user, None) == Actor(type=ActorType.USER, actor_id=self.user.id)

    def test_anonymous(self) -> None:
        assert resolve_actor(AnonymousUser(), None) is None

    def test_credential_without_user(self) -> None:
        assert resolve_actor(AnonymousUser(), AuthenticatedToken(kind="org_auth_token")) is None

    def test_agent_token(self) -> None:
        auth = AuthenticatedToken(kind="agent_token", user_id=self.user.id)
        actor = resolve_actor(serialize_rpc_user(self.user), auth)
        assert actor == Actor(type=ActorType.AGENT, delegated_user_id=self.user.id)


class RequireUserTest(TestCase):
    def test_user(self) -> None:
        request = RequestFactory().get("/")
        request.user = self.user
        assert require_user(request) == self.user

    def test_anonymous(self) -> None:
        request = RequestFactory().get("/")
        request.user = AnonymousUser()
        with pytest.raises(NotAuthenticated):
            require_user(request)

    def test_service_account(self) -> None:
        request: Any = RequestFactory().get("/")
        request.user = ServiceAccountPrincipal(service_account_id=1, organization_id=1, name="sa")
        with pytest.raises(UserRequired):
            require_user(request)


@all_silo_test
class SetRequestPrincipalTest(TestCase):
    def test_sets_user_and_auth(self) -> None:
        request = Request(RequestFactory().get("/"))
        auth = AuthenticatedToken(kind="org_auth_token")
        set_request_principal(request, self.user, auth)
        assert request.user is self.user
        assert request.auth is auth

    def test_drf_authentication_goes_through_it(self) -> None:
        request = Request(RequestFactory().get("/"))
        with mock.patch.object(
            principal, "set_request_principal", wraps=principal.set_request_principal
        ) as set_principal:
            assert acting_user_id(request.user) is None
        set_principal.assert_called_once_with(request, request.user, request.auth)

    def test_drf_authentication_updates_viewer_context_actor(self) -> None:
        ctx = ViewerContext(actor=Actor(type=ActorType.UNKNOWN), organization_id=1)
        with viewer_context_scope(ctx):
            assert self._drf_request(self.user).user == self.user
            assert get_viewer_context() == ViewerContext(
                actor=Actor(type=ActorType.USER, actor_id=self.user.id), organization_id=1
            )
        assert get_viewer_context() is None

    def test_drf_authentication_keeps_superuser_for_same_actor(self) -> None:
        actor = Actor(
            type=ActorType.USER, actor_id=self.user.id, superuser=SuperuserAccess(expires_at=1)
        )
        with viewer_context_scope(ViewerContext(actor=actor)):
            assert self._drf_request(self.user).user == self.user
            assert get_viewer_context() == ViewerContext(actor=actor)

    def test_drf_authentication_without_caller_keeps_actor(self) -> None:
        actor = Actor(type=ActorType.USER, actor_id=self.user.id)
        with viewer_context_scope(ViewerContext(actor=actor)):
            assert self._drf_request(None).user.is_anonymous
            assert get_viewer_context() == ViewerContext(actor=actor)

    def test_drf_authentication_from_viewer_context_keeps_its_actor(self) -> None:
        actor = Actor(type=ActorType.AGENT, delegated_user_id=self.user.id)
        with viewer_context_scope(ViewerContext(actor=actor)):
            assert self._drf_request(self.user, from_viewer_context=True).user == self.user
            assert get_viewer_context() == ViewerContext(actor=actor)

    def test_does_not_touch_viewer_context(self) -> None:
        actor = Actor(type=ActorType.USER, actor_id=self.user.id)
        with viewer_context_scope(ViewerContext(actor=actor)):
            set_request_principal(RequestFactory().get("/"), AnonymousUser(), None)
            assert get_viewer_context() == ViewerContext(actor=actor)

    def test_leaves_lazy_user_unloaded(self) -> None:
        # Loading Django's lazy user reads the session, which adds Vary: Cookie to every response.
        request = RequestFactory().get("/")
        lazy_user = SimpleLazyObject(lambda: pytest.fail("loaded the lazy user"))
        set_request_principal(request, lazy_user, None)
        user: object = request.user
        assert user is lazy_user

    def _drf_request(self, user: User | None, from_viewer_context: bool = False) -> Request:
        class Authentication(BaseAuthentication):
            def authenticate(self, request: Request) -> tuple[User, None] | None:
                # As ViewerContextAuthentication marks a user it loaded from the signed header.
                if from_viewer_context:
                    setattr(request, "user_from_viewer_context", True)
                return (user, None) if user is not None else None

        return Request(RequestFactory().get("/"), authenticators=[Authentication()])


SRC = Path(__file__).parents[3] / "src" / "sentry"


def _is_request_user(node: ast.AST) -> bool:
    if not (isinstance(node, ast.Attribute) and node.attr == "user"):
        return False
    value = node.value
    return (isinstance(value, ast.Name) and value.id == "request") or (
        isinstance(value, ast.Attribute) and value.attr == "request"
    )


def _count(predicate: Callable[[ast.AST], bool]) -> int:
    return sum(
        1
        for path in SRC.rglob("*.py")
        for node in ast.walk(ast.parse(path.read_bytes()))
        if predicate(node)
    )


def _is_request_user_id(node: ast.AST) -> bool:
    return (
        isinstance(node, ast.Attribute)
        and node.attr in ("id", "pk")
        and _is_request_user(node.value)
    )


def _is_request_user_type_check(node: ast.AST) -> bool:
    return (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id in ("isinstance", "hasattr", "getattr")
        and bool(node.args)
        and _is_request_user(node.args[0])
    )


# Lower these as callers move off. Exact, so the baseline can't drift back up.
REQUEST_USER_ID_BASELINE = 483
REQUEST_USER_TYPE_CHECK_BASELINE = 31


def test_request_user_id_uses_only_go_down() -> None:
    count = _count(_is_request_user_id)
    assert count <= REQUEST_USER_ID_BASELINE, (
        f"{count - REQUEST_USER_ID_BASELINE} new request.user.id use(s). It isn't a user id "
        "for callers with no user, e.g. service accounts: read acting_user_id(request.user) and "
        "handle None, or call require_user(request) if this only works for a person."
    )
    assert count == REQUEST_USER_ID_BASELINE, (
        f"request.user.id uses dropped to {count}; lower REQUEST_USER_ID_BASELINE to match."
    )


def test_request_user_type_checks_only_go_down() -> None:
    count = _count(_is_request_user_type_check)
    assert count <= REQUEST_USER_TYPE_CHECK_BASELINE, (
        f"{count - REQUEST_USER_TYPE_CHECK_BASELINE} new isinstance/hasattr/getattr check(s) "
        "on request.user. Callers include agents and service accounts: branch on "
        "acting_user_id(request.user) or is_authenticated instead."
    )
    assert count == REQUEST_USER_TYPE_CHECK_BASELINE, (
        f"request.user type checks dropped to {count}; lower "
        "REQUEST_USER_TYPE_CHECK_BASELINE to match."
    )
