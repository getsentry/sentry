from __future__ import annotations

import functools
from typing import Callable, Optional, Tuple

import pytest
from django.contrib.auth.models import AnonymousUser, User
from django.core.cache import cache
from django.http import HttpRequest
from django.test import override_settings

from sentry.app import env
from sentry.middleware.auth import AuthenticationMiddleware
from sentry.models import AuthIdentity, AuthProvider
from sentry.silo import SiloMode
from sentry.testutils.factories import Factories
from sentry.utils.auth import login
from sentry.web.client_config import get_client_config

RequestFactory = Callable[[], Optional[Tuple[HttpRequest, User]]]


def request_factory(f):
    @functools.wraps(f)
    def wrapper(*args, **kwds) -> Tuple[HttpRequest, User] | None:
        result = f(*args, **kwds)
        if result is not None:
            request, user = result
            if not user.is_anonymous:
                login(request, user)
                AuthenticationMiddleware().process_request(request)
            else:
                request.user = user
                request.auth = None
            env.request = request
            cache.clear()
        else:
            env.request = None
        return result

    return wrapper


@request_factory
def make_request() -> Tuple[HttpRequest, User]:
    request = HttpRequest()
    request.method = "GET"
    request.META["REMOTE_ADDR"] = "127.0.0.1"
    request.META["SERVER_NAME"] = "testserver"
    request.META["SERVER_PORT"] = 80
    request.session = Factories.create_session()
    return request, AnonymousUser()


@request_factory
def make_user_request(org=None) -> Tuple[HttpRequest, User]:
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


@request_factory
def make_user_request_from_non_existant_org(org=None):
    request, user = make_user_request_from_org(org)
    request.session["activeorg"] = 47381
    return request, user


def make_user_request_from_org_with_auth_identities(org=None):
    request, user = make_user_request_from_org(org)
    org = user.get_orgs()[0]
    provider = AuthProvider.objects.create(
        organization=org, provider="google", config={"domain": "olddomain.com"}
    )
    AuthIdentity.objects.create(user=user, auth_provider=provider, ident="me@google.com", data={})
    return request, user


@request_factory
def none_request() -> None:
    return None


@pytest.fixture(autouse=True)
def clear_env_request():
    env.request = None
    yield
    env.request = None


@pytest.mark.parametrize(
    "request_factory",
    [
        none_request,
        make_request,
        make_user_request,
        make_user_request_from_org,
        make_user_request_from_non_existant_org,
        make_user_request_from_org_with_auth_identities,
    ],
)
@pytest.mark.django_db(transaction=True)
def test_client_config_in_silo_modes(request_factory: RequestFactory):
    request = request_factory()
    if request is not None:
        request, _ = request

    base_line = get_client_config(request)
    cache.clear()

    with override_settings(SILO_MODE=SiloMode.REGION):
        assert get_client_config(request) == base_line
        cache.clear()

    with override_settings(SILO_MODE=SiloMode.CONTROL):
        assert get_client_config(request) == base_line
