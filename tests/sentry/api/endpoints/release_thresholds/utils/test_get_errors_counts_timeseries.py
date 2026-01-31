from unittest import mock

from django.utils import timezone
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op

from sentry.api.endpoints.release_thresholds.utils import (
    get_errors_counts_timeseries_by_project_and_release,
)
from sentry.api.endpoints.release_thresholds.utils.get_errors_counts_timeseries import (
    _get_errors_counts_timeseries_eap,
    _get_errors_counts_timeseries_snuba,
)
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.testutils.cases import TestCase


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


class GetErrorCountTimeseriesEAPTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(name="foo", organization=self.org)

    @mock.patch("sentry.snuba.occurrences_rpc.Occurrences.run_grouped_timeseries_query")
    def test_eap_impl_returns_empty_list_on_exception(
        self, mock_timeseries: mock.MagicMock
    ) -> None:
        mock_timeseries.side_effect = Exception("RPC failed")
        now = timezone.now()

        result = _get_errors_counts_timeseries_eap(
            end=now,
            organization_id=self.org.id,
            project_id_list=[self.project.id],
            release_value_list=["1.0.0"],
            start=now,
        )

        assert result == []

    @mock.patch("sentry.snuba.occurrences_rpc.Occurrences.run_grouped_timeseries_query")
    def test_eap_impl_transforms_results_correctly(self, mock_timeseries: mock.MagicMock) -> None:
        mock_timeseries.return_value = [
            {
                "release": "backend@1.0.0",
                "project_id": self.project.id,
                "environment": "production",
                "time": 1736074800,  # Unix timestamp
                "count()": 5.0,
            },
            {
                "release": "backend@1.0.0",
                "project_id": self.project.id,
                "environment": "production",
                "time": 1736074860,  # 1 minute later
                "count()": 3.0,
            },
        ]

        now = timezone.now()
        result = _get_errors_counts_timeseries_eap(
            end=now,
            organization_id=self.org.id,
            project_id_list=[self.project.id],
            release_value_list=["backend@1.0.0"],
            start=now,
        )

        mock_timeseries.assert_called_once()
        assert len(result) == 2

        assert result[0]["release"] == "backend@1.0.0"
        assert result[0]["project_id"] == self.project.id
        assert result[0]["environment"] == "production"
        assert result[0]["count()"] == 3
        assert "time" in result[0]

        assert result[1]["count()"] == 5

    @mock.patch("sentry.snuba.occurrences_rpc.Occurrences.run_grouped_timeseries_query")
    def test_eap_impl_handles_multiple_releases(self, mock_timeseries: mock.MagicMock) -> None:
        mock_timeseries.return_value = [
            {
                "release": "backend@1.0.0",
                "project_id": self.project.id,
                "environment": "production",
                "time": 1736074800,
                "count()": 5.0,
            },
            {
                "release": "backend@2.0.0",
                "project_id": self.project.id,
                "environment": "production",
                "time": 1736074800,
                "count()": 10.0,
            },
        ]

        now = timezone.now()
        result = _get_errors_counts_timeseries_eap(
            end=now,
            organization_id=self.org.id,
            project_id_list=[self.project.id],
            release_value_list=["backend@1.0.0", "backend@2.0.0"],
            start=now,
        )

        assert len(result) == 2
        releases_in_result = [r["release"] for r in result]
        assert "backend@1.0.0" in releases_in_result
        assert "backend@2.0.0" in releases_in_result

    @mock.patch("sentry.snuba.occurrences_rpc.Occurrences.run_grouped_timeseries_query")
    def test_eap_impl_with_environment_filter(self, mock_timeseries: mock.MagicMock) -> None:
        mock_timeseries.return_value = [
            {
                "release": "backend@1.0.0",
                "project_id": self.project.id,
                "environment": "staging",
                "time": 1736074800,
                "count()": 5.0,
            },
        ]

        now = timezone.now()
        result = _get_errors_counts_timeseries_eap(
            end=now,
            organization_id=self.org.id,
            project_id_list=[self.project.id],
            release_value_list=["backend@1.0.0"],
            start=now,
            environments_list=["staging"],
        )

        mock_timeseries.assert_called_once()
        call_kwargs = mock_timeseries.call_args[1]
        assert "staging" in call_kwargs["query_string"]
        assert "type:error" in call_kwargs["query_string"]
        assert len(result) == 1
        assert result[0]["environment"] == "staging"

    @mock.patch(
        "sentry.api.endpoints.release_thresholds.utils.get_errors_counts_timeseries._get_errors_counts_timeseries_eap"
    )
    @mock.patch(
        "sentry.api.endpoints.release_thresholds.utils.get_errors_counts_timeseries._get_errors_counts_timeseries_snuba"
    )
    def test_uses_snuba_result_as_source_of_truth(
        self, mock_snuba: mock.MagicMock, mock_eap: mock.MagicMock
    ) -> None:
        mock_snuba.return_value = [
            {
                "release": "1.0.0",
                "project_id": self.project.id,
                "environment": "production",
                "time": "2025-01-05T10:00:00+00:00",
                "count()": 5,
            }
        ]
        mock_eap.return_value = [
            {
                "release": "1.0.0",
                "project_id": self.project.id,
                "environment": "production",
                "time": "2025-01-05T10:00:00+00:00",
                "count()": 10,  # Different count to verify which is returned
            }
        ]

        now = timezone.now()
        with self.options({EAPOccurrencesComparator._should_eval_option_name(): True}):
            result = get_errors_counts_timeseries_by_project_and_release(
                end=now,
                organization_id=self.org.id,
                project_id_list=[self.project.id],
                release_value_list=["1.0.0"],
                start=now,
            )

        mock_snuba.assert_called_once()
        mock_eap.assert_called_once()
        # Should return Snuba result (count=5), not EAP result (count=10)
        assert result == mock_snuba.return_value
        assert result[0]["count()"] == 5

    @mock.patch(
        "sentry.api.endpoints.release_thresholds.utils.get_errors_counts_timeseries._get_errors_counts_timeseries_eap"
    )
    @mock.patch(
        "sentry.api.endpoints.release_thresholds.utils.get_errors_counts_timeseries._get_errors_counts_timeseries_snuba"
    )
    def test_uses_eap_result_when_callsite_allowlisted(
        self, mock_snuba: mock.MagicMock, mock_eap: mock.MagicMock
    ) -> None:
        mock_snuba.return_value = [
            {
                "release": "1.0.0",
                "project_id": self.project.id,
                "environment": "production",
                "time": "2025-01-05T10:00:00+00:00",
                "count()": 5,
            }
        ]
        mock_eap.return_value = [
            {
                "release": "1.0.0",
                "project_id": self.project.id,
                "environment": "production",
                "time": "2025-01-05T10:00:00+00:00",
                "count()": 10,  # Different count to verify which is returned
            }
        ]

        now = timezone.now()
        with self.options(
            {
                EAPOccurrencesComparator._should_eval_option_name(): True,
                EAPOccurrencesComparator._callsite_allowlist_option_name(): [
                    "release_thresholds.get_errors_counts_timeseries"
                ],
            }
        ):
            result = get_errors_counts_timeseries_by_project_and_release(
                end=now,
                organization_id=self.org.id,
                project_id_list=[self.project.id],
                release_value_list=["1.0.0"],
                start=now,
            )

        mock_snuba.assert_called_once()
        mock_eap.assert_called_once()
        # Should return EAP result (count=10), not Snuba result (count=5)
        assert result == mock_eap.return_value
        assert result[0]["count()"] == 10
