from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.utils import json
from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature


class SentryAppsStatsTest(APITestCase):
    def setUp(self):
        self.superuser = self.create_user(email='a@example.com', is_superuser=True)
        self.user = self.create_user(email='boop@example.com')
        self.org = self.create_organization(owner=self.user)
        self.super_org = self.create_organization(owner=self.superuser)

        self.app_1 = self.create_sentry_app(
            name='Test',
            organization=self.super_org,
            published=True,
        )

        self.app_2 = self.create_sentry_app(
            name='Testin',
            organization=self.org,
        )

        self.create_sentry_app_installation(slug=self.app_1.slug, organization=self.org)
        self.create_sentry_app_installation(slug=self.app_2.slug, organization=self.org)

        self.url = reverse('sentry-api-0-sentry-apps-stats')

    def test_superuser_has_access(self):
        self.login_as(user=self.superuser, superuser=True)

        response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert {
            'id': self.app_2.id,
            'slug': self.app_2.slug,
            'name': self.app_2.name,
            'installs': 1,
        } in json.loads(response.content)

        assert {
            'id': self.app_1.id,
            'slug': self.app_1.slug,
            'name': self.app_1.name,
            'installs': 1,
        } in json.loads(response.content)

    @with_feature('organizations:sentry-apps')
    def test_nonsuperusers_have_no_access(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format='json')

        assert response.status_code == 403
