from typing import Any

from django.test import RequestFactory

from sentry.api.bases.organization_events import OrganizationEventsEndpointBase
from sentry.snuba import discover, metrics_enhanced_performance, metrics_performance, transactions
from sentry.testutils.cases import TestCase
from sentry.testutils.requests import drf_request_from_request


class OrganizationEventsRoutingHintTest(TestCase):
    def serialize_results(
        self, meta: dict[str, Any], data: list[dict[str, str]], standard_meta: bool = True
    ) -> dict[str, Any]:
        request = drf_request_from_request(RequestFactory().get("/", {"field": ["id"]}))
        return OrganizationEventsEndpointBase().handle_results_with_meta(
            request,
            self.organization,
            [],
            {"data": data, "meta": meta},
            standard_meta=standard_meta,
        )

    def test_routing_hint_preserves_standard_meta(self) -> None:
        meta = {
            "fields": {"id": "string"},
            "routing_hint": "opaque+/==",
            "full_scan": False,
            "bytes_scanned": 123,
        }
        result = self.serialize_results(meta, [{"id": "span-id"}])

        assert result["data"] == [{"id": "span-id"}]
        assert result["meta"]["routingHint"] == "opaque+/=="
        assert result["meta"]["fields"] == {"id": "string"}
        assert result["meta"]["units"] == {"id": None}
        assert result["meta"]["dataScanned"] == "partial"
        assert result["meta"]["bytesScanned"] == 123
        assert "routing_hint" not in result["meta"]

    def test_empty_result_retains_routing_hint(self) -> None:
        result = self.serialize_results({"fields": {}, "routing_hint": "opaque"}, [])

        assert result["data"] == []
        assert result["meta"]["routingHint"] == "opaque"

    def test_missing_routing_hint_is_omitted(self) -> None:
        result = self.serialize_results({"fields": {}}, [])

        assert "routingHint" not in result["meta"]

    def test_empty_routing_hint_is_omitted(self) -> None:
        result = self.serialize_results({"fields": {}, "routing_hint": ""}, [])

        assert "routingHint" not in result["meta"]

    def test_legacy_meta_is_unchanged(self) -> None:
        result = self.serialize_results(
            {"fields": {"id": "string"}, "routing_hint": "opaque"}, [], standard_meta=False
        )

        assert result["meta"] == {
            "id": "string",
            "isMetricsData": False,
            "isMetricsExtractedData": False,
        }


class OrganizationEventsEndpointBaseGetDatasetTest(TestCase):
    def resolve(self, dataset_label: str, **params: str):
        request = drf_request_from_request(
            RequestFactory().get("/", {"dataset": dataset_label, **params})
        )
        return OrganizationEventsEndpointBase().get_dataset(request, self.organization)

    def test_metrics_resolves_to_metrics_enhanced_performance(self) -> None:
        assert self.resolve("metrics") is metrics_enhanced_performance

    def test_metrics_stays_on_metrics_performance_for_on_demand(self) -> None:
        assert self.resolve("metrics", useOnDemandMetrics="true") is metrics_performance

    def test_metrics_enhanced_is_unchanged(self) -> None:
        assert self.resolve("metricsEnhanced") is metrics_enhanced_performance

    def test_discover_is_unchanged(self) -> None:
        assert self.resolve("discover") is discover

    def test_transactions_is_unchanged(self) -> None:
        assert self.resolve("transactions") is transactions
