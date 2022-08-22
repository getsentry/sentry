import pytest

from sentry.release_health.release_monitor.metrics import MetricReleaseMonitorBackend
from sentry.testutils import BaseMetricsTestCase, TestCase
from tests.sentry.release_health.release_monitor import (
    FetchProjectReleaseHealthTotalsTestBase,
    FetchProjectsWithRecentSessionsTestBase,
)

pytestmark = pytest.mark.sentry_metrics


class MetricFetchProjectsWithRecentSessionsTest(
    FetchProjectsWithRecentSessionsTestBase, TestCase, BaseMetricsTestCase
):
    backend_class = MetricReleaseMonitorBackend


class SessionFetchProjectReleaseHealthTotalsTest(
    FetchProjectReleaseHealthTotalsTestBase, TestCase, BaseMetricsTestCase
):
    backend_class = MetricReleaseMonitorBackend
