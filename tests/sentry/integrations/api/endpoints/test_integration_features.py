from rest_framework import status

from sentry.integrations.models.integration_feature import Feature, IntegrationFeature
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class IntegrationFeaturesTest(APITestCase):
    endpoint = "sentry-api-0-integration-features"
    method = "GET"

    def setUp(self):
        self.user = self.create_user(email="cynthia@poke.mon")
        self.login_as(self.user)

    def test_returns_all_features(self):
        """
        Tests that all of the default IntegrationFeatures were returned
        """
        response = self.get_success_response(status_code=status.HTTP_200_OK)
        all_features = Feature.as_choices()
        # Ensure all features were returned
        assert len({item["featureId"] for item in response.data}) == len(all_features)
        for feature in response.data:
            # Ensure their featureGate matches the featureId
            assert feature["featureGate"] == str(Feature.from_int(feature["featureId"]))

    def test_no_records_are_created(self):
        """
        Tests that calling this endpoint does not save any
        IntegrationFeatures to the database
        """
        existing_count = IntegrationFeature.objects.count()
        self.get_success_response(status_code=status.HTTP_200_OK)
        assert existing_count == IntegrationFeature.objects.count()
