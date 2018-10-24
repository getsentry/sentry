from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.constants import SentryAppStatus
from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.mediators.sentry_apps import Creator as SentryAppCreator


class OrganizationSentryAppsTest(APITestCase):
    def setUp(self):
        self.superuser = self.create_user(email='a@example.com', is_superuser=True)
        self.user = self.create_user(email='boop@example.com')
        self.org = self.create_organization(owner=self.user)
        self.super_org = self.create_organization(owner=self.superuser)
        self.published_app = SentryAppCreator.run(
            name='Test',
            organization=self.super_org,
            scopes=(),
            webhook_url='https://example.com',
        )
        self.published_app.update(status=SentryAppStatus.PUBLISHED)
        self.unpublished_app = SentryAppCreator.run(
            name='Testin',
            organization=self.org,
            scopes=(),
            webhook_url='https://example.com',
        )
        self.url = reverse('sentry-api-0-organization-sentry-apps', args=[self.org.slug])


class GetOrganizationSentryAppsTest(OrganizationSentryAppsTest):
    @with_feature('organizations:internal-catchall')
    def test_gets_all_apps_in_own_org(self):
        self.login_as(user=self.user)
        response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert response.data == [{
            'name': self.unpublished_app.name,
            'scopes': [],
            'uuid': self.unpublished_app.uuid,
            'webhook_url': self.unpublished_app.webhook_url,
        }]

    @with_feature('organizations:internal-catchall')
    def test_cannot_see_apps_in_other_orgs(self):
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-organization-sentry-apps', args=[self.super_org.slug])
        response = self.client.get(url, format='json')

        assert response.status_code == 403

    def test_no_access_without_internal_catchall(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format='json')
        assert response.status_code == 404
