import pytest

from sentry.processing import realtime_metrics
from sentry.tasks.low_priority_symbolication import _scan_for_suspect_projects, calculation_magic
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.utils import redis
from sentry.utils.compat import mock


@pytest.fixture
def redis_cluster() -> redis._RedisCluster:
    return redis.redis_clusters.get("default")


@mock.patch("sentry.tasks.low_priority_symbolication.calculation_magic", lambda x, y: True)
def test_scan_for_suspect_projects() -> None:
    realtime_metrics.increment_project_event_counter(17, 0)
    with TaskRunner():
        _scan_for_suspect_projects()
    assert realtime_metrics.get_lpq_projects() == {17}


def test_calculation_magic():
    assert not calculation_magic([], [])
