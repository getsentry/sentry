from django.utils.functional import SimpleLazyObject

from sentry.service_accounts.principal import ServiceAccountPrincipal
from sentry.testutils.cases import TestCase
from sentry.users.services.user.serial import serialize_generic_user


class SerializeGenericUserTest(TestCase):
    def test_simple_lazy_object_not_yet_evaluated(self) -> None:
        """Lazy user from middleware must not raise when _wrapped is still empty."""
        user = self.create_user()
        lazy_user = SimpleLazyObject(lambda: user)
        rpc = serialize_generic_user(lazy_user)
        assert rpc is not None
        assert rpc.id == user.id

    def test_service_account(self) -> None:
        principal = ServiceAccountPrincipal(
            service_account_id=1, organization_id=1, name="deploy-bot"
        )
        assert serialize_generic_user(principal) is None
