from sentry.auth.password_validation import MinimumLengthValidator
from sentry.models import User
from sentry.testutils import APITestCase
from sentry.utils.compat import mock


class UserPasswordTest(APITestCase):
    endpoint = "sentry-api-0-user-password"
    method = "put"

    def setUp(self):
        self.user = self.create_user(email="a@example.com", is_managed=False, name="example name")
        self.user.set_password("helloworld!")
        self.user.save()

        self.login_as(self.user)

    def test_change_password(self):
        old_password = self.user.password
        self.get_valid_response(
            "me",
            status_code=204,
            **{
                "password": "helloworld!",
                "passwordNew": "testpassword",
                "passwordVerify": "testpassword",
            },
        )
        user = User.objects.get(id=self.user.id)
        assert old_password != user.password

    # Not sure why but sentry.auth.password_validation._default_password_validators is [] instead of None and not
    # using `settings.AUTH_PASSWORD_VALIDATORS`
    @mock.patch(
        "sentry.auth.password_validation.get_default_password_validators",
        mock.Mock(return_value=[MinimumLengthValidator(min_length=6)]),
    )
    def test_password_too_short(self):
        self.get_valid_response(
            "me",
            status_code=400,
            **{
                "password": "helloworld!",
                "passwordNew": "hi",
                "passwordVerify": "hi",
            },
        )

    def test_no_password(self):
        self.get_valid_response("me", status_code=400, **{"password": "helloworld!"})
        self.get_valid_response("me", status_code=400)

    def test_require_current_password(self):
        self.get_valid_response(
            "me",
            status_code=400,
            **{
                "password": "wrongpassword",
                "passwordNew": "testpassword",
                "passwordVerify": "passworddoesntmatch",
            },
        )

    def test_verifies_mismatch_password(self):
        self.get_valid_response(
            "me",
            status_code=400,
            **{
                "password": "helloworld!",
                "passwordNew": "testpassword",
                "passwordVerify": "passworddoesntmatch",
            },
        )

    def test_managed_unable_change_password(self):
        user = self.create_user(email="new@example.com", is_managed=True)
        self.login_as(user)

        self.get_valid_response(
            user.id,
            status_code=400,
            **{"passwordNew": "newpassword", "passwordVerify": "newpassword"},
        )

    def test_unusable_password_unable_change_password(self):
        user = self.create_user(email="new@example.com")
        user.set_unusable_password()
        user.save()
        self.login_as(user)

        self.get_valid_response(
            user.id,
            status_code=400,
            **{"passwordNew": "newpassword", "passwordVerify": "newpassword"},
        )

    def test_cannot_change_other_user_password(self):
        user = self.create_user(email="new@example.com", is_superuser=False)
        self.login_as(user)

        self.get_valid_response(
            self.user.id,
            status_code=403,
            **{
                "password": "helloworld!",
                "passwordNew": "newpassword",
                "passwordVerify": "newpassword",
            },
        )

    def test_superuser_can_change_other_user_password(self):
        user = self.create_user(email="new@example.com", is_superuser=True)
        self.login_as(user, superuser=True)

        self.get_valid_response(
            self.user.id,
            status_code=204,
            **{
                "password": "helloworld!",
                "passwordNew": "newpassword",
                "passwordVerify": "newpassword",
            },
        )
