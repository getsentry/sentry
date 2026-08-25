from contextlib import contextmanager
from unittest.mock import MagicMock, patch

from sentry.incidents.utils.subscription_limits import is_metric_subscription_allowed
from sentry.models.organization import Organization
from sentry.snuba.dataset import Dataset


class TestIsMetricSubscriptionAllowed:
    org = MagicMock(spec=Organization)

    @contextmanager
    def fake_features(self, enabled: set[str]):
        with patch("sentry.incidents.utils.subscription_limits.features") as mock_features:
            mock_features.has.side_effect = lambda name, *a, **kw: name in enabled
            yield

    # -- Events: ungated --

    def test_events_always_allowed(self) -> None:
        with self.fake_features(set()):
            assert is_metric_subscription_allowed(Dataset.Events.value, self.org) is True

    # -- Transactions: requires :performance-view --

    def test_transactions_without_any_features(self) -> None:
        with self.fake_features(set()):
            assert is_metric_subscription_allowed(Dataset.Transactions.value, self.org) is False

    def test_transactions_with_performance_view(self) -> None:
        with self.fake_features({"organizations:performance-view"}):
            assert is_metric_subscription_allowed(Dataset.Transactions.value, self.org) is True

    # -- EAP: requires :visibility-explore-view --

    def test_eap_without_any_features(self) -> None:
        with self.fake_features(set()):
            assert (
                is_metric_subscription_allowed(Dataset.EventsAnalyticsPlatform.value, self.org)
                is False
            )

    def test_eap_with_explore_view(self) -> None:
        with self.fake_features({"organizations:visibility-explore-view"}):
            assert (
                is_metric_subscription_allowed(Dataset.EventsAnalyticsPlatform.value, self.org)
                is True
            )

    # -- PerformanceMetrics: requires :on-demand-metrics-extraction only --

    def test_performance_metrics_without_on_demand(self) -> None:
        with self.fake_features(set()):
            assert (
                is_metric_subscription_allowed(Dataset.PerformanceMetrics.value, self.org) is False
            )

    def test_performance_metrics_with_on_demand(self) -> None:
        with self.fake_features({"organizations:on-demand-metrics-extraction"}):
            assert (
                is_metric_subscription_allowed(Dataset.PerformanceMetrics.value, self.org) is True
            )

    # -- Unknown / other datasets: always allowed --

    def test_unknown_dataset_always_allowed(self) -> None:
        with self.fake_features(set()):
            assert is_metric_subscription_allowed("unknown_dataset", self.org) is True
