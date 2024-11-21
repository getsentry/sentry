from __future__ import annotations

import functools
from collections.abc import Callable
from typing import Optional

from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.http import HttpRequest

from sentry.app import env
from sentry.middleware.auth import AuthenticationMiddleware
from sentry.middleware.placeholder import placeholder_get_response
from sentry.testutils.factories import Factories
from sentry.users.models.user import User
from sentry.utils.auth import login

RequestFactory = Callable[[], Optional[tuple[HttpRequest, User]]]


def request_factory(f):
    @functools.wraps(f)
    def wrapper(*args, **kwds) -> tuple[HttpRequest, User] | None:
        result = f(*args, **kwds)
        if result is not None:
            request, user = result
            if not user.is_anonymous:
                login(request, user)
                AuthenticationMiddleware(placeholder_get_response).process_request(request)
            else:
                request.user = user
                request.auth = None
            env.request = request
            cache.clear()
        else:
            env.clear()
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
def make_user_request(org=None) -> tuple[HttpRequest, User]:
    request, _ = make_request()
    user = Factories.create_user()
    org = org or Factories.create_organization()
    Factories.create_member(organization=org, user=user)
    teams = [Factories.create_team(org, members=[user]) for i in range(2)]
    [Factories.create_project(org, teams=teams) for i in range(2)]
    return request, user


@request_factory
def make_user_request_from_org(org=None):
    org = org or Factories.create_organization()
    request, user = make_user_request(org)
    request.session["activeorg"] = org.slug
    return request, user
