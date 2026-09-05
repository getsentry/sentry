from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.core.endpoints.scim.constants import SCIM_SCHEMA_USER
from sentry.testutils.cases import SCIMTestCase


class SCIMSchemaDetailsDocs(APIDocsTestCase, SCIMTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.url = reverse(
            "sentry-api-0-organization-scim-schema-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "schema_uri": SCIM_SCHEMA_USER,
            },
        )

    def test_get(self) -> None:
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)
        self.validate_schema(request, response)
