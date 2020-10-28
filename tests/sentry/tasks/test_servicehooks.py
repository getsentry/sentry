from __future__ import absolute_import

import responses

from sentry.utils.compat.mock import patch

from sentry.tasks.servicehooks import get_payload_v0, process_service_hook
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.testutils.helpers.faux import faux
from sentry.utils import json


class DictContaining(object):
    def __init__(self, *keys):
        self.keys = keys

    def __eq__(self, other):
        return all([k in other.keys() for k in self.keys])


class Any(object):
    def __eq__(self, other):
        return True


class TestServiceHooks(TestCase):
    def setUp(self):
        self.project = self.create_project()

        self.hook = self.create_service_hook(project=self.project, events=("issue.created",))

    @patch("sentry.tasks.servicehooks.safe_urlopen")
    @responses.activate
    def test_verify_sentry_hook_signature(self, safe_urlopen):
        import hmac
        from hashlib import sha256

        event = self.store_event(
            data={"timestamp": iso_format(before_now(minutes=1))}, project_id=self.project.id
        )

        process_service_hook(self.hook.id, event)

        body = json.dumps(get_payload_v0(event))

        expected = hmac.new(
            key=self.hook.secret.encode("utf-8"), msg=body.encode("utf-8"), digestmod=sha256
        ).hexdigest()

        assert expected == faux(safe_urlopen).kwargs["headers"]["X-ServiceHook-Signature"]

    @patch("sentry.tasks.servicehooks.safe_urlopen")
    @responses.activate
    def test_event_created_sends_service_hook(self, safe_urlopen):
        self.hook.update(events=["event.created", "event.alert"])

        event = self.store_event(
            data={"timestamp": iso_format(before_now(minutes=1))}, project_id=self.project.id
        )

        process_service_hook(self.hook.id, event)

        data = json.loads(faux(safe_urlopen).kwargs["data"])

        assert faux(safe_urlopen).kwarg_equals("url", self.hook.url)
        assert data == json.loads(json.dumps(get_payload_v0(event)))
        assert faux(safe_urlopen).kwarg_equals(
            "headers",
            DictContaining(
                "Content-Type",
                "X-ServiceHook-Timestamp",
                "X-ServiceHook-GUID",
                "X-ServiceHook-Signature",
            ),
        )

    @responses.activate
    def test_v0_payload(self):
        responses.add(responses.POST, "https://example.com/sentry/webhook")

        event = self.store_event(
            data={"timestamp": iso_format(before_now(minutes=1))}, project_id=self.project.id
        )

        process_service_hook(self.hook.id, event)
        body = get_payload_v0(event)
        assert body["group"]["url"] == "http://testserver/organizations/{}/issues/{}/".format(
            self.organization.slug, event.group.id
        )
        assert body["event"][
            "url"
        ] == "http://testserver/organizations/{}/issues/{}/events/{}/".format(
            self.organization.slug, event.group.id, event.event_id
        )
