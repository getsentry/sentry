from __future__ import absolute_import

from copy import deepcopy

from django.core.urlresolvers import reverse

from sentry.assistant import manager
from sentry.testutils import APITestCase


class AssistantActivity(APITestCase):
    def setUp(self):
        super(AssistantActivity, self).setUp()
        self.login_as(user=self.user)
        self.path = reverse('sentry-api-0-assistant')
        self.guides = manager.all()

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

    def test_activity(self):
        guides_with_seen = deepcopy(manager.all())
        for g in guides_with_seen:
            guides_with_seen[g]['seen'] = False

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp.data == guides_with_seen

        # Dismiss the guide and make sure it is not returned again.
        resp = self.client.put(self.path, {
            'guide_id': 2,
            'status': 'dismissed',
        })
        assert resp.status_code == 201
        resp = self.client.get(self.path)
        guides_with_seen['releases']['seen'] = True
        assert resp.status_code == 200
        assert resp.data == guides_with_seen

    def test_validate_guides(self):
        # Steps in different guides should not have the same target.
        guides = self.guides.values()
        for i in range(len(guides)):
            for j in range(0, i):
                steps_i = set(s['target'] for s in guides[i]['steps'])
                steps_j = set(s['target'] for s in guides[j]['steps'])
                assert not(steps_i & steps_j)
