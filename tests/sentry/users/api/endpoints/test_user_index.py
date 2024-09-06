from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test
from sentry.users.models.userpermission import UserPermission


@control_silo_test
class UserListTest(APITestCase):
    endpoint = "sentry-api-0-user-index"

    def setUp(self):
        super().setUp()
        self.superuser = self.create_user("bar@example.com", is_superuser=True)
        self.normal_user = self.create_user("foo@example.com", is_superuser=False)

        self.login_as(user=self.superuser, superuser=True)

    def test_normal_user_fails(self):
        self.login_as(self.normal_user)
        self.get_error_response(status_code=403)

    @override_options({"staff.ga-rollout": True})
    def test_staff_simple(self):
        self.staff_user = self.create_user(is_staff=True)
        self.login_as(self.staff_user, staff=True)

        response = self.get_success_response()
        assert len(response.data) == 3

    def test_superuser_simple(self):
        response = self.get_success_response()
        assert len(response.data) == 2

    def test_generic_query(self):
        response = self.get_success_response(qs_params={"query": "@example.com"})
        assert len(response.data) == 2

        response = self.get_success_response(qs_params={"query": "bar"})
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.superuser.id)

        response = self.get_success_response(qs_params={"query": "foobar"})
        assert len(response.data) == 0

    def test_superuser_query(self):
        response = self.get_success_response(qs_params={"query": "is:superuser"})
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.superuser.id)

    def test_email_query(self):
        response = self.get_success_response(qs_params={"query": "email:bar@example.com"})
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.superuser.id)

        response = self.get_success_response(qs_params={"query": "email:foobar"})
        assert len(response.data) == 0

    def test_basic_query(self):
        UserPermission.objects.create(user=self.superuser, permission="broadcasts.admin")

        response = self.get_success_response(qs_params={"query": "permission:broadcasts.admin"})
        assert len(response.data) == 1

        response = self.get_success_response(qs_params={"query": "permission:foobar"})
        assert len(response.data) == 0
