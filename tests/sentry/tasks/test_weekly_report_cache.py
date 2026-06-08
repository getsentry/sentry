from sentry.tasks.summaries.weekly_report_cache import (
    _floor_to_saturday,
    _make_cache_key,
    cache_project_metrics,
    read_project_metrics,
)
from sentry.testutils.cases import TestCase

# 2025-05-31 00:00:00 UTC (Saturday)
SATURDAY_TS = 1748649600.0
# 2025-06-02 00:00:00 UTC (Monday)
MONDAY_TS = 1748822400.0


class WeeklyReportCacheTest(TestCase):
    def test_make_cache_key(self) -> None:
        key = _make_cache_key(org_id=1, project_id=2, timestamp=1000.0)
        assert key == "wr:proj_metrics:1:2:1000.0"

    def test_floor_to_saturday(self) -> None:
        assert _floor_to_saturday(SATURDAY_TS) == SATURDAY_TS
        assert _floor_to_saturday(MONDAY_TS) == SATURDAY_TS

    def test_cache_and_read_project_metrics(self) -> None:
        org_id = self.organization.id
        project = self.create_project(organization=self.organization)

        cache_project_metrics(org_id, SATURDAY_TS, {project.id: {"e": 500, "t": 3000}})

        result = read_project_metrics(
            org_id=org_id,
            project_ids=[project.id],
            current_timestamp=SATURDAY_TS,
            previous_timestamp=SATURDAY_TS - 604800,
        )

        assert project.id in result
        assert result[project.id]["current"] == {"e": 500, "t": 3000}
        assert result[project.id]["previous"] is None

    def test_cache_on_monday_readable_with_saturday(self) -> None:
        org_id = self.organization.id
        project = self.create_project(organization=self.organization)

        cache_project_metrics(org_id, MONDAY_TS, {project.id: {"e": 10, "t": 20}})

        result = read_project_metrics(
            org_id=org_id,
            project_ids=[project.id],
            current_timestamp=SATURDAY_TS,
            previous_timestamp=SATURDAY_TS - 604800,
        )

        assert result[project.id]["current"] == {"e": 10, "t": 20}

    def test_read_both_weeks(self) -> None:
        org_id = self.organization.id
        project = self.create_project(organization=self.organization)
        previous_ts = SATURDAY_TS - 604800

        cache_project_metrics(org_id, SATURDAY_TS, {project.id: {"e": 100, "t": 200}})
        cache_project_metrics(org_id, previous_ts, {project.id: {"e": 80, "t": 150}})

        result = read_project_metrics(
            org_id=org_id,
            project_ids=[project.id],
            current_timestamp=SATURDAY_TS,
            previous_timestamp=previous_ts,
        )

        assert result[project.id]["current"] == {"e": 100, "t": 200}
        assert result[project.id]["previous"] == {"e": 80, "t": 150}

    def test_read_empty_cache(self) -> None:
        result = read_project_metrics(
            org_id=self.organization.id,
            project_ids=[999],
            current_timestamp=SATURDAY_TS,
            previous_timestamp=SATURDAY_TS - 604800,
        )

        assert result == {}

    def test_read_empty_project_ids(self) -> None:
        result = read_project_metrics(
            org_id=self.organization.id,
            project_ids=[],
            current_timestamp=SATURDAY_TS,
            previous_timestamp=SATURDAY_TS - 604800,
        )

        assert result == {}

    def test_cache_empty_metrics_is_noop(self) -> None:
        cache_project_metrics(self.organization.id, SATURDAY_TS, {})

    def test_multiple_projects(self) -> None:
        org_id = self.organization.id
        p1 = self.create_project(organization=self.organization)
        p2 = self.create_project(organization=self.organization)

        cache_project_metrics(
            org_id,
            SATURDAY_TS,
            {
                p1.id: {"e": 100, "t": 200},
                p2.id: {"e": 300, "t": 400},
            },
        )

        result = read_project_metrics(
            org_id=org_id,
            project_ids=[p1.id, p2.id],
            current_timestamp=SATURDAY_TS,
            previous_timestamp=SATURDAY_TS - 604800,
        )

        assert result[p1.id]["current"] == {"e": 100, "t": 200}
        assert result[p2.id]["current"] == {"e": 300, "t": 400}
