from sentry.service_accounts.auth import (
    SERVICE_ACCOUNT_TOKEN_KIND,
    authenticate_service_account,
    resolve_service_account,
)
from sentry.service_accounts.principal import ServiceAccountPrincipal
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.viewer_context import Actor, ActorType, ViewerContext


class ResolveServiceAccountTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.service_account = self.create_service_account(
            organization=self.organization, scope_list=["project:read", "event:read"]
        )

    def assert_resolves(self) -> None:
        result = resolve_service_account(self.service_account.id, self.organization.id)

        assert result is not None
        principal, token = result
        assert principal == ServiceAccountPrincipal(
            service_account_id=self.service_account.id,
            organization_id=self.organization.id,
            name=self.service_account.name,
        )
        assert token.kind == SERVICE_ACCOUNT_TOKEN_KIND
        assert token.entity_id == self.service_account.id
        assert token.organization_id == self.organization.id
        assert token.scopes == ["event:read", "project:read"]

    @with_feature("organizations:service-accounts")
    def test_resolves_in_cell(self) -> None:
        self.assert_resolves()

    @with_feature("organizations:service-accounts")
    def test_resolves_in_control(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False):
            self.assert_resolves()

    def test_without_feature_returns_none(self) -> None:
        assert resolve_service_account(self.service_account.id, self.organization.id) is None
        with assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False):
            assert resolve_service_account(self.service_account.id, self.organization.id) is None

    @with_feature("organizations:service-accounts")
    def test_other_org_returns_none(self) -> None:
        other_org = self.create_organization()

        assert resolve_service_account(self.service_account.id, other_org.id) is None
        with assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False):
            assert resolve_service_account(self.service_account.id, other_org.id) is None

    @with_feature("organizations:service-accounts")
    def test_deleted_account_returns_none(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            assert self.service_account.deactivate()

        assert resolve_service_account(self.service_account.id, self.organization.id) is None
        with assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False):
            assert resolve_service_account(self.service_account.id, self.organization.id) is None

    @with_feature("organizations:service-accounts")
    def test_viewer_context_resolves_the_same_account(self) -> None:
        vc = ViewerContext(
            actor=Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=self.service_account.id),
            organization_id=self.organization.id,
        )

        assert authenticate_service_account(vc) == resolve_service_account(
            self.service_account.id, self.organization.id
        )

    @with_feature("organizations:service-accounts")
    def test_viewer_context_for_a_user_returns_none(self) -> None:
        vc = ViewerContext(
            actor=Actor(type=ActorType.USER, actor_id=self.service_account.id),
            organization_id=self.organization.id,
        )

        assert authenticate_service_account(vc) is None
