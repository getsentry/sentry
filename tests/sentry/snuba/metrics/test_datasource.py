import time

import pytest

from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.datasource import get_stored_mris
from sentry.snuba.metrics.naming_layer import TransactionMRI
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

    def test_get_stored_mris_with_transaction(self):
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"release": "1.0"},
            value=1,
        )

        mris = get_stored_mris([self.project], UseCaseID.TRANSACTIONS)
        assert mris == ["d:transactions/duration@millisecond"]

    def test_get_stored_mris_with_session(self):
        self.store_session(
            self.build_session(
                distinct_id="39887d89-13b2-4c84-8c23-5d13d2102666",
                session_id="5d52fd05-fcc9-4bf3-9dc9-267783670341",
                status="exited",
                release="foo@1.0.0",
                environment="prod",
                started=time.time() // 60 * 60,
                received=time.time(),
            )
        )

        mris = get_stored_mris([self.project], UseCaseID.SESSIONS)
        assert mris == [
            "d:sessions/duration@second",
            "c:sessions/session@none",
            "s:sessions/user@none",
        ]
