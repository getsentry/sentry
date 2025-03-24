from datetime import datetime, timezone

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test
from sentry.users.models.userip import UserIP


@control_silo_test
class UserIPsTest(APITestCase):
    endpoint = "sentry-api-0-user-ips"

    def setUp(self):
        super().setUp()
        self.user = self.create_user(id=1)
        self.login_as(self.user)

    def test_simple(self):
        UserIP.objects.create(
            user=self.user,
            ip_address="127.0.0.2",
            first_seen=datetime(2012, 4, 5, 3, 29, 45, tzinfo=timezone.utc),
            last_seen=datetime(2012, 4, 5, 3, 29, 45, tzinfo=timezone.utc),
        )

        # this will always be the newest because when we access the site it gets updated
        UserIP.objects.create(
            user=self.user,
            ip_address="127.0.0.1",
            first_seen=datetime(2012, 4, 3, 3, 29, 45, tzinfo=timezone.utc),
            last_seen=datetime(2013, 4, 10, 3, 29, 45, tzinfo=timezone.utc),
        )

        response = self.get_success_response("me")
        assert len(response.data) == 2

        assert response.data[0]["ipAddress"] == "127.0.0.1"
        assert response.data[1]["ipAddress"] == "127.0.0.2"

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [1]})
    def test_demo_user(self):
        response = self.get_response("me")
        assert response.status_code == 403
