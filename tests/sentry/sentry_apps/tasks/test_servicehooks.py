from unittest.mock import patch

import responses

from sentry.sentry_apps.tasks.service_hooks import get_payload_v0, process_service_hook
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba
from sentry.utils import json

pytestmark = [requires_snuba]


class TestServiceHooks(TestCase):
    def setUp(self):
        self.hook = self.create_service_hook(project=self.project, events=("issue.created",))

    @patch("sentry.sentry_apps.tasks.service_hooks.safe_urlopen")
    @responses.activate
    def test_verify_sentry_hook_signature(self, safe_urlopen):
        import hmac
        from hashlib import sha256

        event = self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat()}, project_id=self.project.id
        )

        process_service_hook(self.hook.id, event)

        body = json.dumps(get_payload_v0(event))

        expected = hmac.new(
            key=self.hook.secret.encode("utf-8"), msg=body.encode("utf-8"), digestmod=sha256
        ).hexdigest()

        ((_, kwargs),) = safe_urlopen.call_args_list
        assert expected == kwargs["headers"]["X-ServiceHook-Signature"]

    @patch("sentry.sentry_apps.tasks.service_hooks.safe_urlopen")
    @responses.activate
    def test_event_created_sends_service_hook(self, safe_urlopen):
        self.hook.update(events=["event.created", "event.alert"])

        event = self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat()}, project_id=self.project.id
        )

        process_service_hook(self.hook.id, event)

        ((_, kwargs),) = safe_urlopen.call_args_list
        data = json.loads(kwargs["data"])

        assert kwargs["url"] == self.hook.url
        assert data == json.loads(json.dumps(get_payload_v0(event)))
        assert kwargs["headers"].keys() <= {
            "Content-Type",
            "X-ServiceHook-Timestamp",
            "X-ServiceHook-GUID",
            "X-ServiceHook-Signature",
        }

    @responses.activate
    def test_v0_payload(self):
        responses.add(responses.POST, "https://example.com/sentry/webhook")

        event = self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat()}, project_id=self.project.id
        )
        assert event.group is not None

        process_service_hook(self.hook.id, event)
        body = get_payload_v0(event)
        assert (
            body["group"]["url"]
            == f"http://testserver/organizations/{self.organization.slug}/issues/{event.group.id}/"
        )
        assert (
            body["event"]["url"]
            == f"http://testserver/organizations/{self.organization.slug}/issues/{event.group.id}/events/{event.event_id}/"
        )
