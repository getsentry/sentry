import pytest

from sentry.release_health.release_monitor.metrics import MetricReleaseMonitorBackend
from sentry.testutils.cases import BaseMetricsTestCase
from sentry.testutils.silo import region_silo_test
from tests.sentry.release_health.release_monitor import (
    BaseFetchProjectReleaseHealthTotalsTest,
    BaseFetchProjectsWithRecentSessionsTest,
)

pytestmark = pytest.mark.sentry_metrics


@region_silo_test
class MetricFetchProjectsWithRecentSessionsTest(
    BaseFetchProjectsWithRecentSessionsTest, BaseMetricsTestCase
):
    backend_class = MetricReleaseMonitorBackend


@region_silo_test
class SessionFetchProjectReleaseHealthTotalsTest(
    BaseFetchProjectReleaseHealthTotalsTest, BaseMetricsTestCase
):
    backend_class = MetricReleaseMonitorBackend
