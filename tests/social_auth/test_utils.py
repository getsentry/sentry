from django.contrib.contenttypes.models import ContentType

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test, no_silo_test
from sentry.users.services.user.serial import serialize_rpc_user
from social_auth.backends import SocialAuthBackend
from social_auth.utils import ctype_to_model, model_to_ctype


@control_silo_test
class TestSocialAuthBackendGetUser(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.backend = SocialAuthBackend()

    def test_get_user_returns_none_for_suspended_user(self) -> None:
        self.user.update(is_suspended=True)
        result = self.backend.get_user(self.user.id)
        assert result is None

    def test_get_user_returns_user_for_active_user(self) -> None:
        result = self.backend.get_user(self.user.id)
        assert result is not None
        assert result.id == self.user.id

    def test_get_user_returns_none_for_inactive_user(self) -> None:
        self.user.update(is_active=False)
        result = self.backend.get_user(self.user.id)
        assert result is None


@no_silo_test
class TestSocialAuthUtils(TestCase):
    def test_model_to_ctype(self) -> None:
        val = model_to_ctype(1)
        assert val == 1

        val = model_to_ctype(None)
        assert val is None

        user = self.create_user()
        val = model_to_ctype(user)
        assert val == {"pk": user.id, "ctype": ContentType.objects.get_for_model(user).pk}

        rpc_user = serialize_rpc_user(user)
        val = model_to_ctype(rpc_user)
        assert val == rpc_user.dict()

    def test_ctype_to_model(self) -> None:
        val = ctype_to_model(1)
        assert val == 1

        val = ctype_to_model(None)
        assert val is None

        user = self.create_user()
        ctype_val = {"pk": user.id, "ctype": ContentType.objects.get_for_model(user).pk}
        assert ctype_to_model(ctype_val) == user

        rpc_user = serialize_rpc_user(user)
        assert ctype_to_model(rpc_user.dict()) == rpc_user
