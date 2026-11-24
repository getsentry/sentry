from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.cases import OurLogTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationTraceLogsDocs(APIDocsTestCase, SnubaTestCase, OurLogTestCase):
    def setUp(self) -> None:
        self.login_as(user=self.user)
        self.trace_id = "a" * 32
        self.store_eap_items(
            [
                self.create_ourlog(
                    {"body": "Payment processed", "trace_id": self.trace_id},
                    timestamp=before_now(minutes=10),
                ),
            ]
        )
        self.url = reverse(
            "sentry-api-0-organization-trace-logs",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def test_get(self) -> None:
        response = self.client.get(self.url, {"traceId": self.trace_id, "statsPeriod": "1h"})
        assert len(response.data["data"]) == 1
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
