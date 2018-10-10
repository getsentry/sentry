from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.mediators.sentry_apps import Creator
from sentry.constants import SentryAppStatus


class SentryAppsTest(APITestCase):
    def setUp(self):
        self.superuser = self.create_user(email='a@example.com', is_superuser=True)
        self.user = self.create_user(email='boop@example.com')
        self.org = self.create_organization(owner=self.user)
        self.super_org = self.create_organization(owner=self.superuser)
        self.published_app = Creator.run(
            name='Test',
            user=self.user,
            scopes=(),
            webhook_url='https://example.com',
        )
        self.published_app.update(status=SentryAppStatus.PUBLISHED)
        self.unpublished_app = Creator.run(
            name='Testin',
            user=self.user,
            scopes=(),
            webhook_url='https://example.com',
        )
        self.url = reverse('sentry-api-0-sentry-apps')

    def test_superuser_sees_all_apps(self):
        self.login_as(user=self.superuser)

        with self.feature({
            'organizations:internal-catchall': True,
        }):
            response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert set(o['uuid'] for o in response.data) == set(
            [self.published_app.uuid, self.unpublished_app.uuid])

    def test_users_only_see_published_apps(self):
        self.login_as(user=self.user)

        with self.feature({
            'organizations:internal-catchall': True,
        }):
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
