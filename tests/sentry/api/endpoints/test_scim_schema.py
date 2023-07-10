from sentry.testutils import SCIMTestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class SCIMSchemaEndpointTest(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-schema-index"

    def test_schema_200s(self):
        self.get_success_response(self.organization.slug)
