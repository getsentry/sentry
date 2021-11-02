from sentry.models import UserPermission
from sentry.testutils import APITestCase


class UserDetailsTest(APITestCase):
    endpoint = "sentry-api-0-user-permissions"

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.login_as(user=self.user)


class UserPermissionsGetTest(UserDetailsTest):
    def test_lookup_self(self):
        UserPermission.objects.create(user=self.user, permission="broadcasts.admin")
        UserPermission.objects.create(user=self.user, permission="users.admin")
        resp = self.get_response("me")
        assert resp.status_code == 200
        assert len(resp.data) == 2, resp.data
        assert "broadcasts.admin" in resp.data
        assert "users.admin" in resp.data
