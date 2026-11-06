import pytest
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory
from rest_framework.request import Request

from sentry.api.exceptions import UserRequired
from sentry.auth.principal import (
    RequestPrincipal,
    acting_user_id,
    has_user,
    resolve_actor,
    set_request_principal,
)
from sentry.auth.services.auth import AuthenticatedToken
from sentry.models.organizationmember import OrganizationMember
from sentry.service_accounts.auth import SERVICE_ACCOUNT_TOKEN_KIND
from sentry.service_accounts.principal import ServiceAccountId, ServiceAccountPrincipal
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test
from sentry.users.services.user.service import user_service
from sentry.viewer_context import Actor, ActorType


def test_id_never_equals_a_user_id() -> None:
    account_id: object = ServiceAccountId(42)
    assert account_id != 42
    assert account_id not in {42}
    assert account_id == ServiceAccountId(42)
    assert str(account_id) == "service_account:42"


def test_id_refuses_int_conversion() -> None:
    with pytest.raises(UserRequired):
        int(ServiceAccountId(42))


def test_principal() -> None:
    principal: RequestPrincipal = ServiceAccountPrincipal(
        service_account_id=42, organization_id=1, name="autofix"
    )
    assert acting_user_id(principal) is None
    assert not has_user(principal)
    assert principal.is_authenticated
    assert not principal.is_superuser
    assert principal.get_display_name() == "autofix"
    assert not hasattr(principal, "email")
    assert not hasattr(principal, "pk")


def _principal() -> ServiceAccountPrincipal:
    return ServiceAccountPrincipal(service_account_id=42, organization_id=1, name="autofix")


def _token() -> AuthenticatedToken:
    return AuthenticatedToken(kind=SERVICE_ACCOUNT_TOKEN_KIND, entity_id=42, organization_id=1)


def test_actor() -> None:
    expected = Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=42)
    assert resolve_actor(_principal(), _token()) == expected
    assert resolve_actor(AnonymousUser(), _token()) == expected


def test_drf_request_gets_principal() -> None:
    request = Request(RequestFactory().get("/"))
    principal = _principal()
    set_request_principal(request, principal, _token())
    user: object = request.user
    assert user is principal


def test_django_request_stays_anonymous() -> None:
    # Session auth reads Django's request.user, so a service account must never be on it.
    request = RequestFactory().get("/")
    set_request_principal(request, _principal(), _token())
    assert isinstance(request.user, AnonymousUser)


@cell_silo_test
class ServiceAccountIdCollisionTest(TestCase):
    def test_orm_lookup_by_id_raises(self) -> None:
        principal = ServiceAccountPrincipal(
            service_account_id=self.user.id, organization_id=self.organization.id, name="a"
        )
        with pytest.raises(UserRequired):
            OrganizationMember.objects.filter(user_id=principal.id).exists()  # type: ignore[attr-defined]

    def test_rpc_lookup_by_id_raises(self) -> None:
        principal = ServiceAccountPrincipal(
            service_account_id=self.user.id, organization_id=self.organization.id, name="a"
        )
        with pytest.raises(UserRequired):
            user_service.get_user(user_id=principal.id)  # type: ignore[attr-defined]
