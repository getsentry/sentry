from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.models import IntegrationFeature
from sentry.models.integrationfeature import Feature


class SentryAppFeaturesTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email="boop@example.com")

        self.sentry_app = self.create_sentry_app(
            name="Test", organization=self.create_organization(owner=self.user)
        )
        self.api_feature = IntegrationFeature.objects.get(sentry_app=self.sentry_app)
        self.issue_link_feature = self.create_sentry_app_feature(
            sentry_app=self.sentry_app, feature=Feature.ISSUE_LINK
        )
        self.url = reverse("sentry-api-0-sentry-app-features", args=[self.sentry_app.slug])

    def test_retrieves_all_features(self):
        self.login_as(user=self.user)
        response = self.client.get(self.url, format="json")
        assert response.status_code == 200

        assert {
            "description": self.api_feature.description,
            "featureGate": self.api_feature.feature_str(),
        } in response.data

        assert {
            "description": self.issue_link_feature.description,
            "featureGate": self.issue_link_feature.feature_str(),
        } in response.data
