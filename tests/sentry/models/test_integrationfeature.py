from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.models import IntegrationFeature


class IntegrationFeatureTest(TestCase):
    def setUp(self):
        self.sentry_app = self.create_sentry_app()
        self.integration_feature = IntegrationFeature.objects.get(sentry_app=self.sentry_app)

    def test_feature_str(self):
        assert self.integration_feature.feature_str() == "integrations-api"

    def test_description(self):
        assert (
            self.integration_feature.description
            == "%s can **utilize the Sentry API** to pull data or update resources in Sentry (with permissions granted, of course)."
            % self.sentry_app.name
        )

        self.integration_feature.user_description = "Custom description"
        self.integration_feature.save()
        assert self.integration_feature.description == "Custom description"
