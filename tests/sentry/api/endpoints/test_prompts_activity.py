from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class PromptsActivityTest(APITestCase):
    def setUp(self):
        super(PromptsActivityTest, self).setUp()
        self.login_as(user=self.user)
        self.path = reverse('sentry-api-0-promptsactivity')

    def test_invalid_feature(self):
        # Invalid feature prompt name
        resp = self.client.put(self.path, {
            'organization_id': 1,
            'project_id': 1,
            'feature': 'gibberish',
            'status': 'dismissed',
        })

        assert resp.status_code == 400

    def test_dismiss(self):
        data = {'organization_id': 1,
                'project_id': 1,
                'feature': 'releases',
                }
        resp = self.client.get(self.path, data)
        assert resp.status_code == 200
        assert resp.data == {}

        self.client.put(self.path, {
            'organization_id': 1,
            'project_id': 1,
            'feature': 'releases',
            'status': 'dismissed',
        })

        resp = self.client.get(self.path, data)
        assert resp.status_code == 200
        assert 'data' in resp.data
        assert 'dismissed_ts' in resp.data['data']

    def test_snooze(self):
        data = {'organization_id': 1,
                'project_id': 1,
                'feature': 'releases',
                }
        resp = self.client.get(self.path, data)
        assert resp.status_code == 200
        assert resp.data == {}

        self.client.put(self.path, {
            'organization_id': 1,
            'project_id': 1,
            'feature': 'releases',
            'status': 'snoozed',
        })

        resp = self.client.get(self.path, data)

        assert resp.status_code == 200
        assert 'data' in resp.data
        assert 'snoozed_ts' in resp.data['data']
