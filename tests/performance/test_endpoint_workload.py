import os
from pathlib import Path

import pytest
from perf_harness.workload import EndpointContext, load_workload, run_workload

from sentry.utils import json


@pytest.mark.skipif("SENTRY_PERF_CONFIG" not in os.environ, reason="run bin/perf/profile-endpoint")
class TestEndpointWorkload(EndpointContext):
    def test_profile(self) -> None:
        config = json.loads(os.environ["SENTRY_PERF_CONFIG"])
        workload = load_workload(config["workload_name"], self, config.pop("parameters"))
        config["output"] = Path(config["output"])
        report = run_workload(workload, **config)
        assert report["totals"]["sample_count"] == config["iterations"]


class TestProjectDetailsWorkload(EndpointContext):
    @pytest.fixture(autouse=True)
    def profile_output(self, tmp_path: Path) -> None:
        self.output = tmp_path / "project.json"

    def test_captures_another_endpoint(self) -> None:
        workload = load_workload("project-details", self, {})
        report = run_workload(
            workload,
            output=self.output,
            label="project",
            workload_name="project-details",
            warmups=1,
            iterations=2,
            compare_variants=True,
        )
        assert report["totals"]["explained_query_count"] > 0
        assert report["totals"]["captured_database_time_ms"] > 0
        assert all("sql" not in query for query in report["queries"])
