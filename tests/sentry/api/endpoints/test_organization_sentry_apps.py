from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.utils import json
from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature


def assert_response_json(response, data):
    """
    Normalizes unicode strings by encoding/decoding expected output
    """
    assert json.loads(response.content) == json.loads(json.dumps(data))


class OrganizationSentryAppsTest(APITestCase):
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
        self.url = reverse('sentry-api-0-organization-sentry-apps', args=[self.org.slug])


class GetOrganizationSentryAppsTest(OrganizationSentryAppsTest):
    @with_feature('organizations:internal-catchall')
    def test_gets_all_apps_in_own_org(self):
        self.login_as(user=self.user)
        response = self.client.get(self.url, format='json')

        assert response.status_code == 200

        assert_response_json(response, [{
            'name': self.unpublished_app.name,
            'slug': self.unpublished_app.slug,
            'scopes': [],
            'events': [],
            'uuid': self.unpublished_app.uuid,
            'status': self.unpublished_app.get_status_display(),
            'webhookUrl': self.unpublished_app.webhook_url,
            'redirectUrl': self.unpublished_app.redirect_url,
            'isAlertable': self.unpublished_app.is_alertable,
            'clientId': self.unpublished_app.application.client_id,
            'clientSecret': self.unpublished_app.application.client_secret,
            'overview': self.unpublished_app.overview,
        }])

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
