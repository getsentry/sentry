from datetime import UTC, datetime, timedelta
from typing import Any
from unittest import mock

from django.utils import timezone
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op

from sentry.api.endpoints.release_thresholds.utils.get_errors_counts_timeseries import (
    _get_errors_counts_timeseries_eap,
    _get_errors_counts_timeseries_snuba,
)
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time


class GetErrorCountTimeseriesSnubaTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(name="foo", organization=self.org)

    @mock.patch(
        "sentry.api.endpoints.release_thresholds.utils.get_errors_counts_timeseries.snuba.raw_snql_query"
    )
    def test_errors_timeseries_snuba_fetch(self, mock_snql_query: mock.MagicMock) -> None:
        mock_snql_query.return_value = {"data": []}
        now = timezone.now()
        _get_errors_counts_timeseries_snuba(
            end=now,
            organization_id=self.org.id,
            project_id_list=[],
            release_value_list=[],
            start=now,
        )

        assert mock_snql_query.call_count == 1

    @mock.patch(
        "sentry.api.endpoints.release_thresholds.utils.get_errors_counts_timeseries.snuba.raw_snql_query"
    )
    def test_errors_timeseries_snuba_fetch_called_with_env(
        self, mock_snql_query: mock.MagicMock
    ) -> None:
        mock_snql_query.return_value = {"data": []}
        now = timezone.now()
        env_list = ["foo"]
        _get_errors_counts_timeseries_snuba(
            end=now,
            organization_id=self.org.id,
            project_id_list=[],
            release_value_list=[],
            start=now,
            environments_list=env_list,
        )

        env_condition = Condition(Column("environment"), Op.IN, env_list)
        call_conditions = mock_snql_query.call_args[1]["request"].query.where
        assert env_condition in call_conditions


class TestEAPGetErrorsCountsTimeseries(TestCase, SnubaTestCase):
    FROZEN_TIME = datetime(2026, 2, 12, 6, 0, 0, tzinfo=UTC)

    def _query_both(
        self,
        release_value_list: list[str],
        project_id_list: list[int] | None = None,
        environments_list: list[str] | None = None,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        target_project_ids = project_id_list or [self.project.id]
        start = self.FROZEN_TIME - timedelta(hours=1)
        end = self.FROZEN_TIME + timedelta(hours=1)

        snuba_result = _get_errors_counts_timeseries_snuba(
            end=end,
            organization_id=self.organization.id,
            project_id_list=target_project_ids,
            release_value_list=release_value_list,
            start=start,
            environments_list=environments_list,
        )
        eap_result = _get_errors_counts_timeseries_eap(
            end=end,
            organization_id=self.organization.id,
            project_id_list=target_project_ids,
            release_value_list=release_value_list,
            start=start,
            environments_list=environments_list,
        )
        return snuba_result, eap_result

    @staticmethod
    def _error_event_data(release: str, environment: str) -> dict[str, Any]:
        return {
            "type": "error",
            "release": release,
            "environment": environment,
            "exception": [{"value": "BadError"}],
            "tags": [["release", release], ["environment", environment]],
        }

    @freeze_time(FROZEN_TIME)
    def test_single_release_single_environment(self) -> None:
        release = self.create_release(project=self.project, version="1.0.0")
        ts = (self.FROZEN_TIME - timedelta(minutes=5)).timestamp()
        self.store_events_to_snuba_and_eap(
            "release-thresholds-group-a",
            count=3,
            timestamp=ts,
            extra_event_data=self._error_event_data(release.version, "production"),
        )

        snuba_result, eap_result = self._query_both(
            release_value_list=[release.version], environments_list=["production"]
        )

        assert eap_result == snuba_result
        assert len(snuba_result) == 1
        assert snuba_result[0]["release"] == release.version
        assert snuba_result[0]["environment"] == "production"
        assert snuba_result[0]["count()"] == 3

    @freeze_time(FROZEN_TIME)
    def test_multiple_releases(self) -> None:
        release_a = self.create_release(project=self.project, version="1.0.0")
        release_b = self.create_release(project=self.project, version="2.0.0")
        ts_a = (self.FROZEN_TIME - timedelta(minutes=10)).timestamp()
        ts_b = (self.FROZEN_TIME - timedelta(minutes=5)).timestamp()
        self.store_events_to_snuba_and_eap(
            "release-thresholds-group-a",
            count=2,
            timestamp=ts_a,
            extra_event_data=self._error_event_data(release_a.version, "production"),
        )
        self.store_events_to_snuba_and_eap(
            "release-thresholds-group-b",
            count=4,
            timestamp=ts_b,
            extra_event_data=self._error_event_data(release_b.version, "production"),
        )

        snuba_result, eap_result = self._query_both(
            release_value_list=[release_a.version, release_b.version],
            environments_list=["production"],
        )

        assert eap_result == snuba_result
        assert {row["release"] for row in snuba_result} == {release_a.version, release_b.version}
        counts_by_release = {row["release"]: row["count()"] for row in snuba_result}
        assert counts_by_release[release_a.version] == 2
        assert counts_by_release[release_b.version] == 4

    @freeze_time(FROZEN_TIME)
    def test_environment_filtering(self) -> None:
        release = self.create_release(project=self.project, version="1.0.0")
        ts = (self.FROZEN_TIME - timedelta(minutes=5)).timestamp()
        self.store_events_to_snuba_and_eap(
            "release-thresholds-group-a",
            count=2,
            timestamp=ts,
            extra_event_data=self._error_event_data(release.version, "production"),
        )
        self.store_events_to_snuba_and_eap(
            "release-thresholds-group-b",
            count=1,
            timestamp=ts,
            extra_event_data=self._error_event_data(release.version, "staging"),
        )

        snuba_result, eap_result = self._query_both(
            release_value_list=[release.version], environments_list=["staging"]
        )

        assert eap_result == snuba_result
        assert len(snuba_result) == 1
        assert snuba_result[0]["environment"] == "staging"
        assert snuba_result[0]["count()"] == 1

    @freeze_time(FROZEN_TIME)
    def test_project_isolation(self) -> None:
        other_project = self.create_project(organization=self.organization)
        release = self.create_release(project=self.project, version="1.0.0")
        ts = (self.FROZEN_TIME - timedelta(minutes=5)).timestamp()

        self.store_events_to_snuba_and_eap(
            "release-thresholds-group-local",
            count=2,
            timestamp=ts,
            project_id=self.project.id,
            extra_event_data=self._error_event_data(release.version, "production"),
        )
        self.store_events_to_snuba_and_eap(
            "release-thresholds-group-other",
            count=5,
            timestamp=ts,
            project_id=other_project.id,
            extra_event_data=self._error_event_data(release.version, "production"),
        )

        snuba_result, eap_result = self._query_both(
            release_value_list=[release.version],
            project_id_list=[self.project.id],
            environments_list=["production"],
        )

        assert eap_result == snuba_result
        assert len(snuba_result) == 1
        assert snuba_result[0]["project_id"] == self.project.id
        assert snuba_result[0]["count()"] == 2

    @freeze_time(FROZEN_TIME)
    def test_empty_results(self) -> None:
        release = self.create_release(project=self.project, version="1.0.0")
        snuba_result, eap_result = self._query_both(
            release_value_list=[release.version], environments_list=["production"]
        )

        assert snuba_result == []
        assert eap_result == []
