from sentry.testutils.cases import SCIMTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class SCIMSchemaEndpointTest(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-schema-index"

    def test_schema_200s(self):
        self.get_success_response(self.organization.slug)
