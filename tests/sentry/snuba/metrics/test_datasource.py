import pytest

from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics import TransactionMRI, get_tag_values
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

    def test_get_tag_values(self):
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"release": "1.0"},
            value=1,
        )
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"release": "2.0"},
            value=1,
        )

        values = get_tag_values(
            [self.project], "release", [TransactionMRI.DURATION.value], UseCaseID.TRANSACTIONS
        )
        assert values == [{"key": "release", "value": "1.0"}, {"key": "release", "value": "2.0"}]
