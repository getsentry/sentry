from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.mediators.sentry_app_installations import Creator


class SentryAppInstallationsTest(APITestCase):
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
        self.unpublished_app = self.create_sentry_app(
            name='Testin',
            organization=self.org,
        )

        self.installation, _ = Creator.run(
            slug=self.published_app.slug,
            organization=self.super_org,
            user=self.superuser,
        )

        self.installation2, _ = Creator.run(
            slug=self.unpublished_app.slug,
            organization=self.org,
            user=self.user,
        )

        self.url = reverse(
            'sentry-api-0-sentry-app-installations',
            args=[self.org.slug],
        )


class GetSentryAppInstallationsTest(SentryAppInstallationsTest):
    @with_feature('organizations:internal-catchall')
    def test_superuser_sees_all_installs(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert response.data == [{
            'app': {
                'slug': self.unpublished_app.slug,
                'uuid': self.unpublished_app.uuid,
            },
            'organization': {
                'slug': self.org.slug,
            },
            'uuid': self.installation2.uuid,
        }]

        url = reverse(
            'sentry-api-0-sentry-app-installations',
            args=[self.super_org.slug],
        )

        response = self.client.get(url, format='json')

        assert response.status_code == 200
        assert response.data == [{
            'app': {
                'slug': self.published_app.slug,
                'uuid': self.published_app.uuid,
            },
            'organization': {
                'slug': self.super_org.slug,
            },
            'uuid': self.installation.uuid,
        }]

    @with_feature('organizations:internal-catchall')
    def test_users_only_sees_installs_on_their_org(self):
        self.login_as(user=self.user)
        response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert response.data == [{
            'app': {
                'slug': self.unpublished_app.slug,
                'uuid': self.unpublished_app.uuid,
            },
            'organization': {
                'slug': self.org.slug,
            },
            'uuid': self.installation2.uuid,
        }]

        # Org the User is not a part of
        url = reverse(
            'sentry-api-0-sentry-app-installations',
            args=[self.super_org.slug],
        )

        response = self.client.get(url, format='json')
        assert response.status_code == 404

    def test_no_access_without_internal_catchall(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format='json')
        assert response.status_code == 404


class PostSentryAppInstallationsTest(SentryAppInstallationsTest):
    @with_feature('organizations:internal-catchall')
    def test_install_unpublished_app(self):
        self.login_as(user=self.user)
        app = self.create_sentry_app(
            name='Sample',
            organization=self.org,
        )
        response = self.client.post(
            self.url,
            data={'slug': app.slug},
            format='json',
        )
        expected = {
            'app': {
                'slug': app.slug,
                'uuid': app.uuid,
            },
            'organization': {
                'slug': self.org.slug,
            },
        }

        assert response.status_code == 200, response.content
        assert six.viewitems(expected) <= six.viewitems(response.data)

    @with_feature('organizations:internal-catchall')
    def test_install_published_app(self):
        self.login_as(user=self.user)
        app = self.create_sentry_app(
            name='Sample',
            organization=self.org,
            published=True,
        )
        response = self.client.post(
            self.url,
            data={'slug': app.slug},
            format='json',
        )
        expected = {
            'app': {
                'slug': app.slug,
                'uuid': app.uuid,
            },
            'organization': {
                'slug': self.org.slug,
            },
        }

        assert response.status_code == 200, response.content
        assert six.viewitems(expected) <= six.viewitems(response.data)

    @with_feature('organizations:internal-catchall')
    def test_members_cannot_install_apps(self):
        user = self.create_user('bar@example.com')
        self.create_member(
            organization=self.org,
            user=user,
            role='member',
        )
        self.login_as(user)
        app = self.create_sentry_app(
            name='Sample',
            organization=self.org,
            published=True,
        )
        response = self.client.post(
            self.url,
            data={'slug': app.slug},
            format='json',
        )
        assert response.status_code == 403

    def test_no_access_without_internal_catchall(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format='json')
        assert response.status_code == 404
