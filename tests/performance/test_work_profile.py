import os
from pathlib import Path

import pytest
from profile_work import run_profile, setup_work

from sentry.models.project import Project
from sentry.testutils.cases import APITransactionTestCase, TransactionTestCase
from sentry.utils import json


@pytest.mark.skipif(
    "SENTRY_PERF_CONFIG" not in os.environ, reason="run bin/perf/profile_work.py run"
)
class TestWorkProfile(TransactionTestCase):
    def test_profile(self) -> None:
        config = json.loads(os.environ["SENTRY_PERF_CONFIG"])
        work = setup_work(self)
        config["output"] = Path(config["output"])
        report = run_profile(work, **config)
        assert report["totals"]["sample_count"] == config["iterations"]


class TestGenericWorkProfile(TransactionTestCase):
    @pytest.fixture(autouse=True)
    def profile_output(self, tmp_path: Path) -> None:
        self.output = tmp_path / "orm.json"

    def test_profiles_orm_work_without_api_context(self) -> None:
        project = self.create_project()

        def work() -> int:
            count = Project.objects.filter(id=project.id).count()
            assert count == 1
            return count

        report = run_profile(work, output=self.output, warmups=1, iterations=2)
        assert report["totals"]["query_count"] == 1
        assert report["totals"]["explained_query_count"] == 1
        assert report["queries"][0]["plan"] is not None


class TestEndpointWorkProfile(APITransactionTestCase):
    endpoint = "sentry-api-0-project-details"

    @pytest.fixture(autouse=True)
    def profile_output(self, tmp_path: Path) -> None:
        self.output = tmp_path / "project.json"

    def test_captures_another_endpoint(self) -> None:
        project = self.create_project(teams=[self.team])
        self.login_as(user=self.user)

        def work() -> str:
            response = self.get_success_response(self.organization.slug, project.slug)
            assert response.data["id"] == str(project.id)
            return response.data["slug"]

        report = run_profile(
            work,
            output=self.output,
            label="project",
            warmups=1,
            iterations=2,
        )
        assert report["totals"]["explained_query_count"] > 0
        assert report["totals"]["captured_database_time_ms"] > 0
        assert all("sql" not in query for query in report["queries"])
