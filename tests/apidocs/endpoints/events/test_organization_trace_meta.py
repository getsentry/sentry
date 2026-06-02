from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationTraceMetaDocs(APIDocsTestCase):
    def setUp(self) -> None:
        self.login_as(user=self.user)
        self.trace_id = "a" * 32

        # Seed an event so the trace has at least one project bound to it.
        self.store_event(
            data={
                "fingerprint": ["group1"],
                "timestamp": before_now(minutes=1).isoformat(),
                "contexts": {"trace": {"trace_id": self.trace_id, "span_id": "b" * 16}},
            },
            project_id=self.project.id,
        )

        self.url = reverse(
            "sentry-api-0-organization-trace-meta",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "trace_id": self.trace_id,
            },
        )

    def test_get(self) -> None:
        response = self.client.get(f"{self.url}?statsPeriod=1h&project=-1")
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
