from sentry.tasks.summaries.weekly_report_cache import (
    _make_cache_key,
    cache_project_metrics,
    read_project_metrics,
)
from sentry.testutils.cases import TestCase


class WeeklyReportCacheTest(TestCase):
    def test_make_cache_key(self) -> None:
        key = _make_cache_key(org_id=1, project_id=2)
        assert key == "wr:proj_metrics:1:2"

    def test_write_and_read(self) -> None:
        org_id = self.organization.id
        project = self.create_project(organization=self.organization)

        cache_project_metrics(org_id, {project.id: {"e": 500, "t": 3000}})

        result = read_project_metrics(org_id=org_id, project_ids=[project.id])

        assert result[project.id] == {"e": 500, "t": 3000}

    def test_read_empty_cache(self) -> None:
        result = read_project_metrics(org_id=self.organization.id, project_ids=[999])

        assert result == {}

    def test_read_empty_project_ids(self) -> None:
        result = read_project_metrics(org_id=self.organization.id, project_ids=[])

        assert result == {}

    def test_write_empty_metrics_is_noop(self) -> None:
        cache_project_metrics(self.organization.id, {})

    def test_multiple_projects(self) -> None:
        org_id = self.organization.id
        p1 = self.create_project(organization=self.organization)
        p2 = self.create_project(organization=self.organization)

        cache_project_metrics(
            org_id,
            {
                p1.id: {"e": 100, "t": 200},
                p2.id: {"e": 300, "t": 400},
            },
        )

        result = read_project_metrics(org_id=org_id, project_ids=[p1.id, p2.id])

        assert result[p1.id] == {"e": 100, "t": 200}
        assert result[p2.id] == {"e": 300, "t": 400}
