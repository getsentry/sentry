from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.assistant.guides import GUIDES
from sentry.testutils import APITestCase


class AssistantActivity(APITestCase):
    def setUp(self):
        super(AssistantActivity, self).setUp()
        self.login_as(user=self.user)
        self.path = reverse('sentry-api-0-assistant')

    def test_invalid_inputs(self):
        # Invalid guide id.
        resp = self.client.put(self.path, {
            'guide_id': 1938,
        })
        assert resp.status_code == 400

        # Invalid status.
        resp = self.client.put(self.path, {
            'guide_id': 1,
            'status': 'whats_my_name_again',
        })
        assert resp.status_code == 400

        # Invalid snooze duration.
        resp = self.client.put(self.path, {
            'guide_id': 1,
            'status': 'snoozed',
            'duration_hours': 12,
        })
        assert resp.status_code == 400

    def test_activity(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp.data == GUIDES

        # Dismiss the guide and make sure it is not returned again.
        resp = self.client.put(self.path, {
            'guide_id': 1,
            'status': 'dismissed',
        })
        assert resp.status_code == 201
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp.data == {}
