import pytest

from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics import TransactionMRI, get_tag_values
from sentry.snuba.metrics.naming_layer import TransactionMetricKey
from sentry.testutils.cases import BaseMetricsLayerTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.skips import requires_snuba

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


@pytest.mark.snuba_ci
@freeze_time(BaseMetricsLayerTestCase.MOCK_DATETIME)
class DatasourceTestCase(BaseMetricsLayerTestCase, TestCase):
    @property
    def now(self):
        return BaseMetricsLayerTestCase.MOCK_DATETIME

    def test_get_tag_values_with_mri(self):
        for release in ("1.0", "2.0"):
            self.store_performance_metric(
                name=TransactionMRI.DURATION.value,
                tags={"release": release},
                value=1,
            )

        values = get_tag_values(
            [self.project], "release", [TransactionMRI.DURATION.value], UseCaseID.TRANSACTIONS
        )
        assert values == [{"key": "release", "value": "1.0"}, {"key": "release", "value": "2.0"}]

    def test_get_tag_values_with_public_name(self):
        for satisfaction in ("satisfied", "tolerable", "miserable"):
            self.store_performance_metric(
                name=TransactionMRI.MEASUREMENTS_LCP.value,
                tags={"satisfaction": satisfaction},
                value=1,
            )

        values = get_tag_values(
            [self.project],
            "satisfaction",
            [TransactionMetricKey.MEASUREMENTS_LCP.value],
            UseCaseID.TRANSACTIONS,
        )
        assert values == [
            {"key": "satisfaction", "value": "miserable"},
            {"key": "satisfaction", "value": "satisfied"},
            {"key": "satisfaction", "value": "tolerable"},
        ]
