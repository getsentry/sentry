from sentry.processing import realtime_metrics
from sentry.tasks.low_priority_symbolication import calculation_magic, scan_for_suspect_projects


def test_calculation_magic():
    assert not calculation_magic([], [])


def test_scan_for_suspect_projects() -> None:
    realtime_metrics.increment_project_event_counter(17, 0)
    scan_for_suspect_projects()
