from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationObjectstoreEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-objectstore"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def test_feature_flag_disabled(self):
        """Without feature flag, returns 404"""
        response = self.get_response(self.organization.slug)
        assert response.status_code == 404

    @with_feature("organizations:objectstore-endpoint")
    def test_feature_flag_enabled(self):
        """With feature flag, endpoint is accessible"""
        response = self.get_response(self.organization.slug)
        assert response.status_code == 200
