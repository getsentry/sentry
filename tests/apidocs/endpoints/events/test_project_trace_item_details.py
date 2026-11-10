from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.cases import OurLogTestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils import json


class ProjectTraceItemDetailsDocs(APIDocsTestCase, SnubaTestCase, OurLogTestCase, SpanTestCase):
    def setUp(self) -> None:
        self.login_as(user=self.user)
        self.trace_id = "a" * 32
        self.timestamp = before_now(minutes=10)

    def url(self, item_id: str) -> str:
        return reverse(
            "sentry-api-0-project-trace-item-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "item_id": item_id,
            },
        )

    def test_get_log(self) -> None:
        log = self.create_ourlog(
            {"body": "Payment processed", "trace_id": self.trace_id},
            attributes={
                "sentry.event.serialized_contexts": json.dumps({"os": {"name": "Linux"}}),
                "sentry.event.serialized_extra": json.dumps({"order": 1234}),
                "sentry.event.serialized_breadcrumbs": json.dumps(
                    {"values": [{"type": "default", "message": "Checkout", "timestamp": 1.5}]}
                ),
            },
            timestamp=self.timestamp,
        )
        self.store_eap_items([log])
        url = self.url(log.item_id.hex())

        response = self.client.get(url, {"item_type": "logs", "trace_id": self.trace_id})
        assert response.status_code == 200, response.content
        assert set(response.data["event"]) == {"contexts", "extra", "breadcrumbs"}

        self.validate_schema(RequestFactory().get(url), response)

    def test_get_span_with_links(self) -> None:
        span = self.create_span(
            {
                "sentry_tags": {
                    "links": json.dumps(
                        [
                            {
                                "trace_id": "b" * 32,
                                "span_id": "c" * 16,
                                "sampled": True,
                                "attributes": {"sentry.link.type": "previous_trace"},
                            }
                        ]
                    ),
                },
            },
            start_ts=self.timestamp,
        )
        span["trace_id"] = self.trace_id
        self.store_span(span)
        url = self.url(span["span_id"])

        response = self.client.get(url, {"item_type": "spans", "trace_id": self.trace_id})
        assert response.status_code == 200, response.content
        assert response.data["links"][0]["itemId"] == "c" * 16

        self.validate_schema(RequestFactory().get(url), response)
