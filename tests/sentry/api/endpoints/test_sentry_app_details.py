from __future__ import absolute_import

from django.core.urlresolvers import reverse
from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature


class SentryAppDetailsTest(APITestCase):
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
        self.url = reverse('sentry-api-0-sentry-app-details', args=[self.published_app.slug])


class GetSentryAppDetailsTest(SentryAppDetailsTest):
    @with_feature('organizations:internal-catchall')
    def test_superuser_sees_all_apps(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert response.data == {
            'name': self.published_app.name,
            'scopes': [],
            'uuid': self.published_app.uuid,
            'webhook_url': self.published_app.webhook_url,
        }

        url = reverse('sentry-api-0-sentry-app-details', args=[self.unpublished_app.slug])
        response = self.client.get(url, format='json')

        assert response.status_code == 200
        assert response.data == {
            'name': self.unpublished_app.name,
            'scopes': [],
            'uuid': self.unpublished_app.uuid,
            'webhook_url': self.unpublished_app.webhook_url,
        }

    @with_feature('organizations:internal-catchall')
    def test_users_only_see_published_apps(self):
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-sentry-app-details', args=[self.unpublished_app.slug])

        response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert response.data == {
            'name': self.published_app.name,
            'scopes': [],
            'uuid': self.published_app.uuid,
            'webhook_url': self.published_app.webhook_url,
        }

        url = reverse('sentry-api-0-sentry-app-details', args=[self.unpublished_app.slug])
        response = self.client.get(url, format='json')

        assert response.status_code == 404

    def test_no_access_without_internal_catchall(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format='json')
        assert response.status_code == 404


class UpdateSentryAppDetailsTest(SentryAppDetailsTest):
    @with_feature('organizations:internal-catchall')
    def test_update_published_app(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.put(
            self.url,
            data={
                'name': 'NewName',
                'webhook_url': 'https://newurl.com',
            },
            format='json',
        )
        assert response.data == {
            'name': 'NewName',
            'scopes': [],
            'uuid': self.published_app.uuid,
            'webhook_url': 'https://newurl.com',
        }

    @with_feature('organizations:internal-catchall')
    def test_update_unpublished_app(self):
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-sentry-app-details', args=[self.unpublished_app.slug])

        response = self.client.put(
            url,
            data={
                'name': 'NewName',
                'webhook_url': 'https://newurl.com',
                'scopes': ('project:read',)
            },
            format='json',
        )

        assert response.status_code == 200
        assert response.data == {
            'name': 'NewName',
            'scopes': ['project:read'],
            'uuid': self.unpublished_app.uuid,
            'webhook_url': 'https://newurl.com',
        }

    @with_feature('organizations:internal-catchall')
    def test_cannot_update_scopes_published_app(self):
        self.login_as(user=self.user)

        response = self.client.put(
            self.url,
            data={
                'name': 'NewName',
                'webhook_url': 'https://newurl.com',
                'scopes': ('project:read',)
            },
            format='json',
        )
        assert response.status_code == 500

    @with_feature('organizations:internal-catchall')
    def test_cannot_update_non_owned_apps(self):
        self.login_as(user=self.user)
        app = self.create_sentry_app(
            name='SampleApp',
            organization=self.super_org,
        )
        url = reverse('sentry-api-0-sentry-app-details', args=[app.slug])
        response = self.client.put(
            url,
            data={
                'name': 'NewName',
                'webhook_url': 'https://newurl.com',
            },
            format='json',
        )
        assert response.status_code == 403
