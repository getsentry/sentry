from functools import cached_property

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils import json


@region_silo_test
class GroupEventJsonTest(TestCase):
    @cached_property
    def path(self):
        return f"/organizations/{self.organization.slug}/issues/{self.event.group_id}/events/{self.event.event_id}/json/"

    def test_does_render(self):
        self.login_as(self.user)
        min_ago = iso_format(before_now(minutes=1))
        self.event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": min_ago}, project_id=self.project.id
        )
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"
        data = json.loads(resp.content.decode("utf-8"))
        assert data["event_id"] == self.event.event_id
