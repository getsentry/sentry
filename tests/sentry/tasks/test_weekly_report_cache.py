from sentry.tasks.summaries.weekly_report_cache import (
    _make_cache_key,
    cache_project_metrics,
    read_project_metrics,
)
from sentry.testutils.cases import TestCase


class WeeklyReportCacheTest(TestCase):
    def test_make_cache_key(self) -> None:
        key = _make_cache_key(org_id=1, project_id=2, timestamp=1000.0)
        assert key == "wr:proj_metrics:1:2:1000.0"

    def test_cache_and_read_project_metrics(self) -> None:
        org_id = self.organization.id
        project = self.create_project(organization=self.organization)
        timestamp = 1748563200.0

        metrics = {
            project.id: {"e": 500, "t": 3000},
        }

        cache_project_metrics(org_id, timestamp, metrics)

        result = read_project_metrics(
            org_id=org_id,
            project_ids=[project.id],
            current_timestamp=timestamp,
            previous_timestamp=timestamp - 604800,
        )

        assert project.id in result
        assert result[project.id]["current"] == {"e": 500, "t": 3000}
        assert result[project.id]["previous"] is None

    def test_read_both_weeks(self) -> None:
        org_id = self.organization.id
        project = self.create_project(organization=self.organization)
        current_ts = 1748563200.0
        previous_ts = current_ts - 604800

        cache_project_metrics(org_id, current_ts, {project.id: {"e": 100, "t": 200}})
        cache_project_metrics(org_id, previous_ts, {project.id: {"e": 80, "t": 150}})

        result = read_project_metrics(
            org_id=org_id,
            project_ids=[project.id],
            current_timestamp=current_ts,
            previous_timestamp=previous_ts,
        )

        assert result[project.id]["current"] == {"e": 100, "t": 200}
        assert result[project.id]["previous"] == {"e": 80, "t": 150}

    def test_read_empty_cache(self) -> None:
        result = read_project_metrics(
            org_id=self.organization.id,
            project_ids=[999],
            current_timestamp=1748563200.0,
            previous_timestamp=1747958400.0,
        )

        assert result == {}

    def test_read_empty_project_ids(self) -> None:
        result = read_project_metrics(
            org_id=self.organization.id,
            project_ids=[],
            current_timestamp=1748563200.0,
            previous_timestamp=1747958400.0,
        )

        assert result == {}

    def test_cache_empty_metrics_is_noop(self) -> None:
        cache_project_metrics(self.organization.id, 1748563200.0, {})

    def test_multiple_projects(self) -> None:
        org_id = self.organization.id
        p1 = self.create_project(organization=self.organization)
        p2 = self.create_project(organization=self.organization)
        timestamp = 1748563200.0

        cache_project_metrics(
            org_id,
            timestamp,
            {
                p1.id: {"e": 100, "t": 200},
                p2.id: {"e": 300, "t": 400},
            },
        )

        result = read_project_metrics(
            org_id=org_id,
            project_ids=[p1.id, p2.id],
            current_timestamp=timestamp,
            previous_timestamp=timestamp - 604800,
        )

        assert result[p1.id]["current"] == {"e": 100, "t": 200}
        assert result[p2.id]["current"] == {"e": 300, "t": 400}
