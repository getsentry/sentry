from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class SentryAppFeaturesTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email='boop@example.com')

        self.sentry_app = self.create_sentry_app(
            name='Test',
            organization=self.create_organization(owner=self.user),
        )
        self.feature = self.create_sentry_app_feature(
            sentry_app=self.sentry_app,
        )
        self.url = reverse(
            'sentry-api-0-sentry-app-features',
            args=[self.sentry_app.slug],
        )

    def test_retrieves_all_features(self):
        self.login_as(user=self.user)
        response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert response.data[0] == {
            'description': self.feature.description,
            'featureGate': self.feature.feature_str()
        }
