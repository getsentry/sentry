from __future__ import absolute_import

from datetime import datetime
from django.utils import timezone

from sentry.models import UserIP
from sentry.testutils import APITestCase


class UserEmailsTest(APITestCase):
    def setUp(self):
        super(UserEmailsTest, self).setUp()
        self.user = self.create_user(email="foo@example.com")
        self.login_as(user=self.user)
        self.url = "/api/0/users/me/ips/"

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

        response = self.client.get(self.url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 2

        assert response.data[0]["ipAddress"] == "127.0.0.1"
        assert response.data[1]["ipAddress"] == "127.0.0.2"
