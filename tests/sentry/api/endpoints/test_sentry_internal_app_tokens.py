from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.models import ApiToken


class SentryInternalAppTokenCreationTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email='boop@example.com')
        self.org = self.create_organization(owner=self.user, name='My Org')
        self.project = self.create_project(organization=self.org)

        self.internal_sentry_app = self.create_internal_integration(
            name='My Internal App',
            organization=self.org
        )

        self.url = reverse(
            'sentry-api-0-sentry-internal-app-tokens',
            args=[self.internal_sentry_app.slug],
        )

    @with_feature('organizations:sentry-apps')
    def test_create_token(self):
        self.login_as(user=self.user)
        response = self.client.post(self.url, format='json')
        assert response.status_code == 201

        assert ApiToken.objects.get(token=response.data['token'])

    @with_feature('organizations:sentry-apps')
    def test_non_internal_app(self):
        sentry_app = self.create_sentry_app(
            name='My External App',
            organization=self.org
        )

        url = reverse(
            'sentry-api-0-sentry-internal-app-tokens',
            args=[sentry_app.slug],
        )

        self.login_as(user=self.user)
        response = self.client.post(url, format='json')

        assert response.status_code == 403
        assert response.data == 'This route is limited to internal integrations only'

    @with_feature('organizations:sentry-apps')
    def test_token_limit(self):
        self.login_as(user=self.user)

        # we already have one token created so just need to make 19 more first
        for i in range(19):
            response = self.client.post(self.url, format='json')
            assert response.status_code == 201

        response = self.client.post(self.url, format='json')
        assert response.status_code == 403
        assert response.data == 'Cannot generate more than 20 tokens for a single integration'
