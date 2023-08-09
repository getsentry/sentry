from datetime import timedelta

from django.utils import timezone

from sentry.models import ApiToken
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class ApiTokenTest(TestCase):
    def test_is_expired(self):
        token = ApiToken(expires_at=None)
        assert not token.is_expired()

        token = ApiToken(expires_at=timezone.now() + timedelta(days=1))
        assert not token.is_expired()

        token = ApiToken(expires_at=timezone.now() - timedelta(days=1))
        assert token.is_expired()

    def test_get_scopes(self):
        token = ApiToken(scopes=1)
        assert token.get_scopes() == ["project:read"]

        token = ApiToken(scopes=4, scope_list=["project:read"])
        assert token.get_scopes() == ["project:read"]

        token = ApiToken(scope_list=["project:read"])
        assert token.get_scopes() == ["project:read"]

    def test_enforces_scope_hierarchy(self):
        # token = self.create_user_auth_token(self.create_user(), scope_list=["org:admin"])
        token = ApiToken.objects.create(
            user_id=self.create_user().id,
            scope_list=["org:admin"],
        )
        token.scope_list.append("org:read")
        token.save()

        print(token.get_scopes())
        assert token.get_scopes() == ["project:read"]

        # token = ApiToken(scopes=4, scope_list=["project:read"])
        # assert token.get_scopes() == ["project:read"]

        # token = ApiToken(scope_list=["project:read"])
        # assert token.get_scopes() == ["project:read"]
