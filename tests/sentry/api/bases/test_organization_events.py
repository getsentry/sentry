from django.test import RequestFactory

from sentry.api.bases.organization_events import OrganizationEventsEndpointBase
from sentry.snuba import discover, metrics_enhanced_performance, metrics_performance, transactions
from sentry.testutils.cases import TestCase
from sentry.testutils.requests import drf_request_from_request


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
