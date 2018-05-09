from __future__ import absolute_import

from sentry.testutils import APITestCase
from sentry.integrations.bitbucket.descriptor import BitBucketDescriptorEndpoint


class BitBucketDescriptorEndpointTest(APITestCase):
    def test_default_permissions(self):
        # Permissions must be empty so that it will be accessible.
        assert BitBucketDescriptorEndpoint.authentication_classes == ()
        assert BitBucketDescriptorEndpoint.permission_classes == ()

    def test_response(self):
        response = self.client.get('/extensions/bitbucket/descriptor/')
        assert response.status_code == 200

        assert response.data['key'] == 'sentry-bitbucket'
        assert response.data['authentication']['type'] == 'jwt'
        assert response.data['baseUrl'] == 'http://testserver'
