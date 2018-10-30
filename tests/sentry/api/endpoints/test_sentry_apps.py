from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature


class SentryAppsTest(APITestCase):
    def setUp(self):
        self.superuser = self.create_user(email='a@example.com', is_superuser=True)
        self.user = self.create_user(email='boop@example.com')
        self.org = self.create_organization(owner=self.user)
        self.super_org = self.create_organization(owner=self.superuser)
        self.published_app = self.create_sentry_app(
            name='Test',
            organization=self.org,
            published=True,
        )
        self.unpublished_app = self.create_sentry_app(
            name='Testin',
            organization=self.org,
        )
        self.url = reverse('sentry-api-0-sentry-apps')


class GetSentryAppsTest(SentryAppsTest):
    @with_feature('organizations:internal-catchall')
    def test_superuser_sees_all_apps(self):
        self.login_as(user=self.superuser)

        response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert set(o['uuid'] for o in response.data) == set(
            [self.published_app.uuid, self.unpublished_app.uuid])

    @with_feature('organizations:internal-catchall')
    def test_users_only_see_published_apps(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert response.data == [{
            'name': self.published_app.name,
            'scopes': [],
            'uuid': self.published_app.uuid,
            'webhook_url': self.published_app.webhook_url,
        }]

    def test_no_access_without_internal_catchall(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format='json')
        assert response.status_code == 404


class PostSentryAppsTest(SentryAppsTest):
    @with_feature('organizations:internal-catchall')
    def test_creates_sentry_app(self):
        self.login_as(user=self.user)

        response = self._post()
        expected = {
            'name': 'MyApp',
            'scopes': ['project:read', 'project:write'],
            'webhook_url': 'https://example.com',
        }

        assert response.status_code == 201, response.content
        assert six.viewitems(expected) <= six.viewitems(response.data)

    @with_feature('organizations:internal-catchall')
    def test_missing_name(self):
        self.login_as(self.user)
        response = self._post(name=None)

        assert response.status_code == 422, response.content
        assert 'name' in response.data['errors']

    @with_feature('organizations:internal-catchall')
    def test_missing_scopes(self):
        self.login_as(self.user)
        response = self._post(scopes=None)

        assert response.status_code == 422, response.content
        assert 'scopes' in response.data['errors']

    @with_feature('organizations:internal-catchall')
    def test_invalid_scope(self):
        self.login_as(self.user)
        response = self._post(scopes=('not:ascope', ))

        assert response.status_code == 422, response.content
        assert 'scopes' in response.data['errors']

    @with_feature('organizations:internal-catchall')
    def test_missing_webhook_url(self):
        self.login_as(self.user)
        response = self._post(webhook_url=None)

        assert response.status_code == 422, response.content
        assert 'webhook_url' in response.data['errors']

    def _post(self, **kwargs):
        body = {
            'name': 'MyApp',
            'organization': self.org.slug,
            'scopes': ('project:read', 'project:write'),
            'webhook_url': 'https://example.com',
        }

        body.update(**kwargs)

        return self.client.post(
            self.url,
            body,
            headers={'Content-Type': 'application/json'},
        )
