import datetime

import orjson

from sentry.api.serializers import AppPlatformEvent
from sentry.testutils.cases import TestCase


class AppPlatformEventSerializerTest(TestCase):
    def setUp(self):
        self.user = self.create_user(username="foo")
        self.organization = self.create_organization(owner=self.user)
        self.sentry_app = self.create_sentry_app(organization=self.organization)
        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )

    def test_no_actor(self):
        data = {"time": datetime.datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=datetime.UTC)}
        result = AppPlatformEvent(
            resource="event_alert", action="triggered", install=self.install, data=data
        )

        # Our serializer uses orjson to create the results but the result should match what json
        # creates on customers side
        from sentry.utils import json

        assert result.body == json.dumps(
            {
                "action": "triggered",
                "installation": {"uuid": self.install.uuid},
                "data": data,
                "actor": {"type": "application", "id": "sentry", "name": "Sentry"},
            }
        )

        signature = self.sentry_app.build_signature(result.body)

        assert result.headers["Content-Type"] == "application/json"
        assert result.headers["Sentry-Hook-Resource"] == "event_alert"
        assert result.headers["Sentry-Hook-Signature"] == signature

    def test_sentry_app_actor(self):
        result = AppPlatformEvent(
            resource="issue",
            action="assigned",
            install=self.install,
            data={},
            actor=self.sentry_app.proxy_user,
        )

        assert orjson.loads(result.body)["actor"] == {
            "type": "application",
            "id": self.sentry_app.uuid,
            "name": self.sentry_app.name,
        }

        signature = self.sentry_app.build_signature(result.body)

        assert result.headers["Content-Type"] == "application/json"
        assert result.headers["Sentry-Hook-Resource"] == "issue"
        assert result.headers["Sentry-Hook-Signature"] == signature

    def test_user_actor(self):
        result = AppPlatformEvent(
            resource="installation",
            action="created",
            install=self.install,
            data={},
            actor=self.user,
        )

        assert orjson.loads(result.body)["actor"] == {
            "type": "user",
            "id": self.user.id,
            "name": self.user.name,
        }

        signature = self.sentry_app.build_signature(result.body)

        assert result.headers["Content-Type"] == "application/json"
        assert result.headers["Sentry-Hook-Resource"] == "installation"
        assert result.headers["Sentry-Hook-Signature"] == signature
