from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user_merge_verification_code import UserMergeVerificationCode


@control_silo_test
class PostVerificationCodeTest(APITestCase):
    endpoint = "sentry-api-0-auth-verification-codes"
    method = "post"

    def setUp(self):
        self.login_as(self.user)
        return super().setUp()

    def test_simple(self):
        self.get_success_response()
        code = UserMergeVerificationCode.objects.filter(user=self.user).first()
        assert code is not None


@control_silo_test
class UpdateVerificationCodeTest(APITestCase):
    endpoint = "sentry-api-0-auth-verification-codes"
    method = "put"

    def setUp(self):
        self.login_as(self.user)
        return super().setUp()

    def test_simple(self):
        code = UserMergeVerificationCode.objects.create(user=self.user)
        old_code = code.token

        self.get_success_response()
        code.refresh_from_db()
        assert code.token != old_code

    def test_code_does_not_exist(self):
        response = self.get_error_response()
        assert response.data["error"] == "No verification code exists for the requesting user."
