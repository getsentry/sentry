from sentry.api.endpoints.auth_index import PREFILLED_SU_MODAL_KEY
from sentry.auth.superuser import is_active_superuser
from sentry.models.user import User
from sentry.receivers.superuser import disable_superuser, enable_superuser
from sentry.testutils.cases import TestCase


class SuperuserReceiverTest(TestCase):
    def setUp(self):
        super().setUp()
        self.superuser = User(is_superuser=True, email="superuser_test@sentry.io")
        self.non_superuser = User(is_superuser=False, email="not_a_superuser_test@sentry.io")

        self.superuser_request = self.make_request(user=self.superuser)
        self.non_superuser_request = self.make_request(user=self.non_superuser)

    def test_enable_superuser_when_self_hosted__superuser(self):
        with self.settings(
            SENTRY_SELF_HOSTED=True, VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=False
        ):
            enable_superuser(request=self.superuser_request, user=self.superuser)
            assert is_active_superuser(self.superuser_request)

    def test_enable_superuser_when_flag_on__superuser(self):
        with self.settings(
            SENTRY_SELF_HOSTED=False,
            VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=False,
            ENABLE_SU_UPON_LOGIN_FOR_LOCAL_DEV=True,
        ):
            enable_superuser(request=self.superuser_request, user=self.superuser)
            assert is_active_superuser(self.superuser_request)

    def test_enable_superuser_saas__superuser(self):
        with self.settings(
            SENTRY_SELF_HOSTED=False,
        ):
            enable_superuser(request=self.superuser_request, user=self.superuser)
            assert not is_active_superuser(self.superuser_request)

    def test_enable_superuser_when_self_hosted_non__superuser(self):
        with self.settings(
            SENTRY_SELF_HOSTED=True, VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=False
        ):
            enable_superuser(request=self.non_superuser_request, user=self.non_superuser)
            assert not is_active_superuser(self.non_superuser_request)

    def test_enable_superuser_when_flag_on_non__superuser(self):
        with self.settings(
            SENTRY_SELF_HOSTED=False,
            VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=False,
            ENABLE_SU_UPON_LOGIN_FOR_LOCAL_DEV=True,
        ):
            enable_superuser(request=self.non_superuser_request, user=self.non_superuser)
            assert not is_active_superuser(self.non_superuser_request)

    def test_enable_superuser_when_session_has_prefill_key_superuser(self):

        self.superuser_request.session[PREFILLED_SU_MODAL_KEY] = {
            "superuserAccessCategory": "for_unit_test",
            "superuserReason": "Edit organization settings",
            "isSuperuserModal": True,
        }

        enable_superuser(request=self.superuser_request, user=self.superuser)
        assert is_active_superuser(self.superuser_request)

    def test_enable_superuser_when_session_has_prefill_key_non_superuser(self):

        self.superuser_request.session[PREFILLED_SU_MODAL_KEY] = {
            "superuserAccessCategory": "for_unit_test",
            "superuserReason": "Edit organization settings",
            "isSuperuserModal": True,
        }

        enable_superuser(request=self.non_superuser_request, user=self.non_superuser)
        assert not is_active_superuser(self.non_superuser_request)

    def test_enable_superuser_saas_non__superuser(self):
        with self.settings(
            SENTRY_SELF_HOSTED=False,
        ):
            enable_superuser(request=self.non_superuser_request, user=self.non_superuser)
            assert not is_active_superuser(self.superuser_request)

    def test_disable_superuser_active__superuser(self):
        enable_superuser(request=self.superuser_request, user=self.superuser)
        assert is_active_superuser(self.superuser_request)

        disable_superuser(request=self.superuser_request, user=self.superuser)
        assert not is_active_superuser(self.superuser_request)
