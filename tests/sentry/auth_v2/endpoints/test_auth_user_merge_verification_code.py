from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user_merge_verification_code import UserMergeVerificationCode


@control_silo_test
class VerificationCodeTest(APITestCase):
    endpoint = "sentry-api-0-auth-verification-codes"
    method = "post"

    def setUp(self):
        self.login_as(self.user)
        return super().setUp()

    def test_simple(self):
        self.get_success_response()
        code = UserMergeVerificationCode.objects.filter(user=self.user).first()
        assert code is not None

    def test_update(self):
        code = UserMergeVerificationCode.objects.create(user=self.user)
        old_code = code.token

        self.get_success_response()
        code.refresh_from_db()
        assert code.token != old_code
