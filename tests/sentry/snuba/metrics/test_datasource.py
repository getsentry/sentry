import time

import pytest

from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics import get_tag_values
from sentry.snuba.metrics.datasource import get_stored_mris
from sentry.snuba.metrics.naming_layer import TransactionMetricKey, TransactionMRI
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

    def test_get_stored_mris(self):
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"release": "1.0"},
            value=1,
        )

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

        custom_mri = "d:custom/page_load@millisecond"
        self.store_metric(
            self.project.organization.id,
            self.project.id,
            "distribution",
            custom_mri,
            {},
            int(self.now.timestamp()),
            10,
            UseCaseID.CUSTOM,
        )

        mris = get_stored_mris([self.project], UseCaseID.TRANSACTIONS)
        assert mris == {
            "d:transactions/duration@millisecond": [self.project.id],
        }

        mris = get_stored_mris([self.project], UseCaseID.SESSIONS)
        assert mris == {
            "d:sessions/duration@second": [self.project.id],
            "c:sessions/session@none": [self.project.id],
            "s:sessions/user@none": [self.project.id],
        }

        mris = get_stored_mris([self.project], UseCaseID.CUSTOM)
        assert mris == {
            custom_mri: [self.project.id],
        }

    def test_get_tag_values_with_mri(self):
        releases = ["1.0", "2.0"]
        for release in ("1.0", "2.0"):
            self.store_performance_metric(
                name=TransactionMRI.DURATION.value,
                tags={"release": release},
                value=1,
            )

        values = get_tag_values(
            [self.project], "release", [TransactionMRI.DURATION.value], UseCaseID.TRANSACTIONS
        )
        for release in releases:
            assert {"key": "release", "value": release} in values

    def test_get_tag_values_with_public_name(self):
        satisfactions = ["miserable", "satisfied", "tolerable"]
        for satisfaction in satisfactions:
            self.store_performance_metric(
                name=TransactionMRI.MEASUREMENTS_LCP.value,
                tags={"satisfaction": satisfaction},
                value=1,
            )

        # Valid public metric name.
        values = get_tag_values(
            [self.project],
            "satisfaction",
            [TransactionMetricKey.MEASUREMENTS_LCP.value],
            UseCaseID.TRANSACTIONS,
        )
        for satisfaction in satisfactions:
            assert {"key": "satisfaction", "value": satisfaction} in values

        # Invalid public metric name.
        values = get_tag_values(
            [self.project],
            "satisfaction",
            ["transaction.measurements"],
            UseCaseID.TRANSACTIONS,
        )
        assert values == []
