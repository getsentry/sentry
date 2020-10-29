from __future__ import absolute_import


from exam import fixture

from sentry.utils import json
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class GroupEventJsonTest(TestCase):
    @fixture
    def path(self):
        return u"/organizations/{}/issues/{}/events/{}/json/".format(
            self.organization.slug, self.event.group_id, self.event.event_id
        )

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
