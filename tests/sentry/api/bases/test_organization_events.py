from django.test import RequestFactory

from sentry.api.bases.organization_events import OrganizationEventsEndpointBase
from sentry.snuba import discover, metrics_enhanced_performance, metrics_performance, transactions
from sentry.snuba.utils import get_dataset
from sentry.testutils.cases import TestCase
from sentry.testutils.requests import drf_request_from_request


class OrganizationEventsEndpointBaseGetDatasetTest(TestCase):
    def resolve(self, dataset_label: str):
        request = drf_request_from_request(RequestFactory().get("/", {"dataset": dataset_label}))
        return OrganizationEventsEndpointBase().get_dataset(request, self.organization)

    def test_metrics_resolves_to_metrics_enhanced_performance(self) -> None:
        assert self.resolve("metrics") is metrics_enhanced_performance

    def test_metrics_enhanced_is_unchanged(self) -> None:
        assert self.resolve("metricsEnhanced") is metrics_enhanced_performance

    def test_discover_is_unchanged(self) -> None:
        assert self.resolve("discover") is discover

    def test_transactions_is_unchanged(self) -> None:
        assert self.resolve("transactions") is transactions

    def test_registry_still_maps_metrics_for_alerts(self) -> None:
        # Alerts compare against metrics_performance to identify the sessions dataset.
        assert get_dataset("metrics") is metrics_performance
