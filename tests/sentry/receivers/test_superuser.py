from sentry.auth.superuser import is_active_superuser
from sentry.models import User
from sentry.receivers.superuser import disable_superuser, enable_superuser
from sentry.testutils import TestCase


class SuperuserReceiverTest(TestCase):
    def setUp(self):
        super().setUp()
        self.superuser = User(is_superuser=True, email="test@sentry.io")
        self.non_superuser = User(is_superuser=False, email="test@sentry.io")

        self.superuser_request = self.make_request(user=self.superuser)
        self.non_superuser_request = self.make_request(user=self.non_superuser)

    def test_enable_superuser_when_self_hosted_superuser(self):
        with self.settings(
            SENTRY_SELF_HOSTED=True, VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=False
        ):
            enable_superuser(request=self.superuser_request, user=self.superuser)
            assert is_active_superuser(self.superuser_request)

    def test_enable_superuser_when_flag_on_superuser(self):
        with self.settings(
            SENTRY_SELF_HOSTED=False,
            VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=False,
            ENABLE_SU_UPON_LOGIN_FOR_LOCAL_DEV=True,
        ):
            enable_superuser(request=self.superuser_request, user=self.superuser)
            assert is_active_superuser(self.superuser_request)

    def test_enable_superuser_when_self_hosted_non_superuser(self):
        with self.settings(
            SENTRY_SELF_HOSTED=True, VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=False
        ):
            enable_superuser(request=self.non_superuser_request, user=self.non_superuser)
            assert not is_active_superuser(self.non_superuser_request)

    def test_enable_superuser_when_flag_on_non_superuser(self):
        with self.settings(
            SENTRY_SELF_HOSTED=False,
            VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=False,
            ENABLE_SU_UPON_LOGIN_FOR_LOCAL_DEV=True,
        ):
            enable_superuser(request=self.non_superuser_request, user=self.non_superuser)
            assert not is_active_superuser(self.non_superuser_request)

    def test_disable_superuser_active_superuser(self):
        enable_superuser(request=self.superuser_request, user=self.superuser)
        assert is_active_superuser(self.superuser_request)

        disable_superuser(request=self.superuser_request, user=self.superuser)
        assert not is_active_superuser(self.superuser_request)
