from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
import responses


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

        self.installation = self.create_sentry_app_installation(
            slug=self.published_app.slug,
            organization=self.super_org,
            user=self.superuser,
        )

        self.unpublished_app = self.create_sentry_app(
            name='Testin',
            organization=self.org,
        )

        self.installation2 = self.create_sentry_app_installation(
            slug=self.unpublished_app.slug,
            organization=self.org,
            user=self.user,
        )

        self.url = reverse(
            'sentry-api-0-sentry-app-installation-details',
            args=[self.installation2.uuid],
        )


class GetSentryAppInstallationDetailsTest(SentryAppInstallationDetailsTest):
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
            'code': self.installation2.api_grant.code,
        }

    def test_no_access_outside_install_organization(self):
        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-sentry-app-installation-details',
            args=[self.installation.uuid],
        )

        response = self.client.get(url, format='json')
        assert response.status_code == 404


class DeleteSentryAppInstallationDetailsTest(SentryAppInstallationDetailsTest):
    @responses.activate
    def test_delete_install(self):
        responses.add(
            url='https://example.com/webhook',
            method=responses.POST,
            body={})
        self.login_as(user=self.user)
        response = self.client.delete(self.url, format='json')

        assert response.status_code == 204

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
