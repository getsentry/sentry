from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.cases import SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationTraceMetaDocs(APIDocsTestCase, SnubaTestCase, SpanTestCase):
    def setUp(self) -> None:
        super().setUp()
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
        # Spans without a transaction are grouped under a null transaction.event_id.
        self.store_spans(
            [
                self.create_span(
                    {"trace_id": self.trace_id, "event_id": None},
                    start_ts=before_now(minutes=1),
                )
            ]
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

        assert response.data["transactionChildCountMap"] == [
            {"transaction.event_id": None, "count()": 1.0}
        ]
        self.validate_schema(request, response)
