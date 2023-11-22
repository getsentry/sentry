from sentry.models.userpermission import UserPermission
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


class UserPermissionsTest(APITestCase):
    endpoint = "sentry-api-0-user-permissions"

    def setUp(self):
        super().setUp()
        self.user = self.create_user(is_superuser=True)
        self.login_as(user=self.user, superuser=True)
        self.add_user_permission(self.user, "users.admin")


@control_silo_test
class UserPermissionsGetTest(UserPermissionsTest):
    def test_lookup_self(self):
        UserPermission.objects.create(user=self.user, permission="broadcasts.admin")
        resp = self.get_response("me")
        assert resp.status_code == 200
        assert len(resp.data) == 2, resp.data
        assert "broadcasts.admin" in resp.data
        assert "users.admin" in resp.data
