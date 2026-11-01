from datetime import timedelta
from typing import Any
from unittest import mock

from django.urls import reverse
from rest_framework.request import Request

from sentry.api.authentication import UserAuthTokenAuthentication
from sentry.auth.principal import set_request_principal
from sentry.service_accounts.principal import ServiceAccountPrincipal
from sentry.service_accounts.tokens import encode_service_account_token
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, cell_silo_test
from sentry.viewer_context import Actor, ActorType, set_viewer_context_actor

FEATURE_FLAG = "organizations:service-accounts"


@cell_silo_test
class ServiceAccountTokenAuthenticationTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization.flags.allow_joinleave = True
        self.organization.save()
        self.service_account = self.create_service_account(
            organization=self.organization, scope_list=["project:read"]
        )

    def _token(self, **kwargs: Any) -> str:
        kwargs.setdefault("service_account_id", self.service_account.id)
        kwargs.setdefault("organization_id", self.organization.id)
        return encode_service_account_token(**kwargs)[0]

    def _get_environments(self, token: str, project: Any = None) -> Any:
        project = project or self.project
        url = reverse(
            "sentry-api-0-project-environments", args=[project.organization.slug, project.slug]
        )
        with self.feature(FEATURE_FLAG):
            return self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_token_authenticates_as_service_account(self) -> None:
        with (
            mock.patch(
                "sentry.auth.principal.set_request_principal", wraps=set_request_principal
            ) as set_principal,
            mock.patch(
                "sentry.auth.principal.set_viewer_context_actor", wraps=set_viewer_context_actor
            ) as set_actor,
        ):
            response = self._get_environments(self._token())

        assert response.status_code == 200
        request, user, auth = set_principal.call_args.args
        assert isinstance(request, Request)
        assert isinstance(user, ServiceAccountPrincipal)
        assert user.service_account_id == self.service_account.id
        assert auth.kind == "service_account"
        set_actor.assert_called_with(
            Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=self.service_account.id)
        )

    def test_user_token_auth_ignores_service_account_tokens(self) -> None:
        assert not UserAuthTokenAuthentication().accepts_auth([b"Bearer", self._token().encode()])

    def test_disabling_the_account_revokes_its_tokens(self) -> None:
        token = self._token()
        assert self._get_environments(token).status_code == 200

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.update(is_active=False)

        assert self._get_environments(token).status_code == 401

    def test_tampered_token_is_rejected(self) -> None:
        token = self._token()
        tampered = token[:-2] + ("AA" if not token.endswith("AA") else "BB")

        assert self._get_environments(tampered).status_code == 401

    def test_expired_token_is_rejected(self) -> None:
        assert self._get_environments(self._token(ttl=timedelta(seconds=-1))).status_code == 401

    def test_token_naming_another_org_is_rejected(self) -> None:
        other = self.create_organization()

        assert self._get_environments(self._token(organization_id=other.id)).status_code == 401

    def test_token_has_no_access_to_another_org(self) -> None:
        other_project = self.create_project(organization=self.create_organization())

        assert self._get_environments(self._token(), other_project).status_code == 403

    def test_flag_off_is_rejected(self) -> None:
        url = reverse(
            "sentry-api-0-project-environments", args=[self.organization.slug, self.project.slug]
        )

        response = self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {self._token()}")

        assert response.status_code == 401
