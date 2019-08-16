from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import UserOption
from sentry.testutils import APITestCase


class UserAppearanceTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email="a@example.com")
        self.login_as(user=self.user)
        self.url = reverse("sentry-api-0-user-appearance", kwargs={"user_id": self.user.id})

    def test_default_options(self):
        resp = self.client.get(self.url)

        assert resp.status_code == 200, resp.content
        assert resp.data["timezone"] == "UTC"
        assert resp.data["stacktraceOrder"] == -1
        assert resp.data["language"] == "en"
        assert not resp.data["clock24Hours"]

    def test_update(self):
        resp = self.client.put(
            self.url,
            data={
                "timezone": "UTC",
                "stacktraceOrder": "2",
                "language": "fr",
                "clock24Hours": True,
                "extra": True,
            },
        )

        assert resp.status_code == 204

        assert UserOption.objects.get_value(user=self.user, key="timezone") == "UTC"
        assert UserOption.objects.get_value(user=self.user, key="stacktrace_order") == "2"
        assert UserOption.objects.get_value(user=self.user, key="language") == "fr"
        assert UserOption.objects.get_value(user=self.user, key="clock_24_hours")
        assert not UserOption.objects.get_value(user=self.user, key="extra")
