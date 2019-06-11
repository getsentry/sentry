from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.models import IntegrationFeature


class IntegrationFeatureTest(TestCase):
    def setUp(self):
        sentry_app = self.create_sentry_app()
        self.integration_feature = IntegrationFeature.objects.get(
            sentry_app=sentry_app,
        )

    def test_feature_str(self):
        assert self.integration_feature.feature_str() == 'integrations-api'

    def test_description(self):
        assert self.integration_feature.description == \
            "This integration can utilize the Sentry API (with the permissions granted) to pull data or update resources in Sentry!"

        self.integration_feature.user_description = "Custom description"
        self.integration_feature.save()
        assert self.integration_feature.description == "Custom description"
