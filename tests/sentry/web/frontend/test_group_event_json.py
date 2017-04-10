from __future__ import absolute_import

import json

from exam import fixture

from sentry.testutils import TestCase


class GroupEventJsonTest(TestCase):
    @fixture
    def path(self):
        return '/{}/{}/issues/{}/events/{}/json/'.format(
            self.organization.slug,
            self.project.slug,
            self.group.id,
            self.event.id,
        )

    def test_does_render(self):
        self.login_as(self.user)
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp['Content-Type'] == 'application/json'
        data = json.loads(resp.content.decode('utf-8'))
        assert data['id'] == self.event.event_id
