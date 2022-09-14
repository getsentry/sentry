import pytest

from sentry.release_health.release_monitor.metrics import MetricReleaseMonitorBackend
from sentry.testutils import BaseMetricsTestCase, TestCase
from sentry.testutils.silo import region_silo_test
from tests.sentry.release_health.release_monitor import (
    BaseFetchProjectReleaseHealthTotalsTest,
    BaseFetchProjectsWithRecentSessionsTest,
)

pytestmark = pytest.mark.sentry_metrics


class MetricFetchProjectsWithRecentSessionsTest(
    BaseFetchProjectsWithRecentSessionsTest, TestCase, BaseMetricsTestCase
):
    backend_class = MetricReleaseMonitorBackend


@region_silo_test
class SessionFetchProjectReleaseHealthTotalsTest(
    BaseFetchProjectReleaseHealthTotalsTest, TestCase, BaseMetricsTestCase
):
    backend_class = MetricReleaseMonitorBackend
