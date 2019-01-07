from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.mediators.sentry_app_installations import Creator


class SentryAppInstallationDetailsTest(APITestCase):
    def setUp(self):
        self.superuser = self.create_user(email='a@example.com', is_superuser=True)
        self.user = self.create_user(email='boop@example.com')
        self.org = self.create_organization(owner=self.user)
        self.super_org = self.create_organization(owner=self.superuser)

        self.published_app = self.create_sentry_app(
            name='Test',
            organization=self.super_org,
            published=True,
        )

        self.installation = Creator.run(
            slug=self.published_app.slug,
            organization=self.super_org,
            user=self.superuser,
        )

        self.unpublished_app = self.create_sentry_app(
            name='Testin',
            organization=self.org,
        )

        self.installation2 = Creator.run(
            slug=self.unpublished_app.slug,
            organization=self.org,
            user=self.user,
        )

        self.url = reverse(
            'sentry-api-0-sentry-app-installation-details',
            args=[self.installation2.uuid],
        )


class GetSentryAppInstallationDetailsTest(SentryAppInstallationDetailsTest):
    @with_feature('organizations:internal-catchall')
    def test_access_within_installs_organization(self):
        self.login_as(user=self.user)
        response = self.client.get(self.url, format='json')

        assert response.status_code == 200, response.content
        assert response.data == {
            'app': {
                'uuid': self.unpublished_app.uuid,
                'slug': self.unpublished_app.slug,
            },
            'organization': {
                'slug': self.org.slug,
            },
            'uuid': self.installation2.uuid,
        }

    @with_feature('organizations:internal-catchall')
    def test_no_access_outside_install_organization(self):
        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-sentry-app-installation-details',
            args=[self.installation.uuid],
        )

        response = self.client.get(url, format='json')
        assert response.status_code == 404

    def test_no_access_without_internal_catchall(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format='json')
        assert response.status_code == 404


class DeleteSentryAppInstallationDetailsTest(SentryAppInstallationDetailsTest):
    @with_feature('organizations:internal-catchall')
    def test_delete_install(self):
        self.login_as(user=self.user)
        response = self.client.delete(self.url, format='json')

        assert response.status_code == 204

    @with_feature('organizations:internal-catchall')
    def test_member_cannot_delete_install(self):
        user = self.create_user('bar@example.com')
        self.create_member(
            organization=self.org,
            user=user,
            role='member',
        )
        self.login_as(user)
        response = self.client.delete(self.url, format='json')

        assert response.status_code == 403
