from django.contrib.contenttypes.models import ContentType

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import no_silo_test
from sentry.users.services.user.serial import serialize_rpc_user
from social_auth.utils import ctype_to_model, model_to_ctype


@no_silo_test
class TestSocialAuthUtils(TestCase):
    def test_model_to_ctype(self):
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

    def test_ctype_to_model(self):
        val = ctype_to_model(1)
        assert val == 1

        val = ctype_to_model(None)
        assert val is None

        user = self.create_user()
        ctype_val = {"pk": user.id, "ctype": ContentType.objects.get_for_model(user).pk}
        assert ctype_to_model(ctype_val) == user

        rpc_user = serialize_rpc_user(user)
        assert ctype_to_model(rpc_user.dict()) == rpc_user
