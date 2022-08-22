from django.urls import reverse

from sentry.models import IntegrationFeature
from sentry.models.integrations.integration_feature import Feature, IntegrationTypes
from sentry.testutils import APITestCase


class SentryAppFeaturesTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email="boop@example.com")

        self.sentry_app = self.create_sentry_app(
            name="Test", organization=self.create_organization(owner=self.user)
        )
        self.api_feature = IntegrationFeature.objects.get(
            target_id=self.sentry_app.id, target_type=IntegrationTypes.SENTRY_APP.value
        )
        self.issue_link_feature = self.create_sentry_app_feature(
            sentry_app=self.sentry_app, feature=Feature.ISSUE_LINK
        )
        self.url = reverse("sentry-api-0-sentry-app-features", args=[self.sentry_app.slug])

    def test_retrieves_all_features(self):
        self.login_as(user=self.user)
        response = self.client.get(self.url, format="json")
        assert response.status_code == 200

        assert {
            "featureId": self.api_feature.feature,
            "description": self.api_feature.description,
            "featureGate": self.api_feature.feature_str(),
        } in response.data

        assert {
            "featureId": self.issue_link_feature.feature,
            "description": self.issue_link_feature.description,
            "featureGate": self.issue_link_feature.feature_str(),
        } in response.data
