from __future__ import annotations

import functools
from collections.abc import Callable
from typing import Optional, ParamSpec, TypeVar, cast

from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.http import HttpRequest
from rest_framework.request import Request
from rest_framework.views import APIView

from sentry.auth.principal import set_request_principal
from sentry.middleware.auth import AuthenticationMiddleware
from sentry.middleware.placeholder import placeholder_get_response
from sentry.models.organization import Organization
from sentry.testutils.factories import Factories
from sentry.users.models.user import User
from sentry.utils.auth import login

RequestFactory = Callable[[], Optional[tuple[HttpRequest, User | AnonymousUser]]]

_P = ParamSpec("_P")
_R = TypeVar(
    "_R",
    bound=tuple[HttpRequest, User] | tuple[HttpRequest, AnonymousUser] | None,
)


def request_factory(f: Callable[_P, _R]) -> Callable[_P, _R]:
    @functools.wraps(f)
    def wrapper(*args: _P.args, **kwds: _P.kwargs) -> _R:
        result = f(*args, **kwds)
        if result is not None:
            request, user = result
            if not user.is_anonymous:
                login(request, user)
                AuthenticationMiddleware(placeholder_get_response).process_request(
                    cast(Request, request)
                )
            else:
                set_request_principal(request, user, None)
            cache.clear()
        return result

    return wrapper


@request_factory
def make_request() -> tuple[HttpRequest, AnonymousUser]:
    request = HttpRequest()
    request.method = "GET"
    request.META["REMOTE_ADDR"] = "127.0.0.1"
    request.META["SERVER_NAME"] = "testserver"
    request.META["SERVER_PORT"] = 80
    request.session = Factories.create_session()
    return request, AnonymousUser()


@request_factory
def make_user_request(org: Organization | None = None) -> tuple[HttpRequest, User]:
    request, _ = make_request()
    user = Factories.create_user()
    org = org or Factories.create_organization()
    Factories.create_member(organization=org, user=user)
    teams = [Factories.create_team(org, members=[user]) for i in range(2)]
    [Factories.create_project(org, teams=teams) for i in range(2)]
    return request, user


@request_factory
def make_user_request_from_org(org: Organization | None = None) -> tuple[HttpRequest, User]:
    org = org or Factories.create_organization()
    request, user = make_user_request(org)
    request.session["activeorg"] = org.slug
    return request, user


def drf_request_from_request(request: HttpRequest) -> Request:
    ret = APIView().initialize_request(request)
    # reattach these if missing
    # XXX: technically `HttpRequest` shouldn't have auth but our tests do!)
    for attr in ("auth", "user"):
        if hasattr(request, attr):
            setattr(ret, attr, getattr(request, attr))
    return ret
