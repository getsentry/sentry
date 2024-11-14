from sentry.integrations.bitbucket.client import BITBUCKET_KEY
from sentry.integrations.bitbucket.descriptor import BitbucketDescriptorEndpoint
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class BitbucketDescriptorEndpointTest(APITestCase):
    def test_default_permissions(self):
        # Permissions must be empty so that it will be accessible to bitbucket.
        assert BitbucketDescriptorEndpoint.authentication_classes == ()
        assert BitbucketDescriptorEndpoint.permission_classes == ()

    def test_response(self):
        response = self.client.get("/extensions/bitbucket/descriptor/")
        assert response.status_code == 200

        assert response.data["key"] == BITBUCKET_KEY
        assert response.data["authentication"]["type"] == "JWT"
        assert response.data["baseUrl"] == "http://testserver"
