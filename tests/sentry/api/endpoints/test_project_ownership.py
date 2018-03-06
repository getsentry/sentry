from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class ProjectOwnershipEndpointTestCase(APITestCase):
    def setUp(self):
        self.login_as(user=self.user)
        self.path = reverse(
            'sentry-api-0-project-ownership',
            kwargs={
                'organization_slug': self.organization.slug,
                'project_slug': self.project.slug,
            },
        )

    def test_empty_state(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp.data == {
            'raw': None,
            'fallthrough': True,
            'isActive': True,
            'dateCreated': None,
            'lastUpdated': None,
        }

    def test_update(self):
        resp = self.client.put(self.path, {
            'raw': '*.js foo@example.com #foo-team',
        })
        assert resp.status_code == 200
        assert resp.data['fallthrough'] is True
        assert resp.data['raw'] == '*.js foo@example.com #foo-team'
        assert resp.data['dateCreated'] is not None
        assert resp.data['lastUpdated'] is not None

        resp = self.client.put(self.path, {
            'fallthrough': False,
        })
        assert resp.status_code == 200
        assert resp.data['fallthrough'] is False
        assert resp.data['raw'] == '*.js foo@example.com #foo-team'
        assert resp.data['dateCreated'] is not None
        assert resp.data['lastUpdated'] is not None

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp.data['fallthrough'] is False
        assert resp.data['raw'] == '*.js foo@example.com #foo-team'
        assert resp.data['dateCreated'] is not None
        assert resp.data['lastUpdated'] is not None

        resp = self.client.put(self.path, {
            'raw': '...',
        })
        assert resp.status_code == 400
