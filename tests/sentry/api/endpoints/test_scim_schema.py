from django.urls import reverse

from .test_scim import SCIMTestCase


class SCIMSchemaEndpointTest(SCIMTestCase):
    def test_schema_200s(self):
        url = reverse(
            "sentry-api-0-organization-scim-schema-index",
            args=[self.organization.slug],
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
