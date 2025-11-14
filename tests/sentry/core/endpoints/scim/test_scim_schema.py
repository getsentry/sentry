from typing import int
from sentry.testutils.cases import SCIMTestCase


class SCIMSchemaEndpointTest(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-schema-index"

    def test_schema_200s(self) -> None:
        self.get_success_response(self.organization.slug)
