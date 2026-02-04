from __future__ import annotations

from datetime import timedelta
from unittest import mock

from django.utils import timezone

from sentry.api.helpers.events import get_events_for_group_eap, run_group_events_query
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.search.events.types import SnubaParams
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now


class GetEventsForGroupEAPTest(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)
        self.now = timezone.now()
        self.snuba_params = SnubaParams(
            start=self.now - timedelta(days=1),
            end=self.now,
            environments=[],
            projects=[self.project],
            organization=self.organization,
        )

    @mock.patch("sentry.api.helpers.events.Occurrences.run_table_query")
    def test_returns_empty_list_on_exception(self, mock_run_table_query: mock.MagicMock) -> None:
        mock_run_table_query.side_effect = Exception("RPC failed")

        result = get_events_for_group_eap(
            query="",
            snuba_params=self.snuba_params,
            group=self.group,
            limit=10,
            offset=0,
            orderby=None,
            referrer="test.referrer",
        )

        assert result == []
        mock_run_table_query.assert_called_once()

    @mock.patch("sentry.api.helpers.events.Occurrences.run_table_query")
    def test_returns_transformed_results(self, mock_run_table_query: mock.MagicMock) -> None:
        mock_run_table_query.return_value = {
            "data": [
                {
                    "id": "abc123",
                    "project_id": self.project.id,
                    "group_id": self.group.id,
                    "timestamp": "2025-01-08T10:00:00Z",
                },
                {
                    "id": "def456",
                    "project_id": self.project.id,
                    "group_id": self.group.id,
                    "timestamp": "2025-01-08T09:00:00Z",
                },
            ]
        }

        result = get_events_for_group_eap(
            query="",
            snuba_params=self.snuba_params,
            group=self.group,
            limit=10,
            offset=0,
            orderby=None,
            referrer="test.referrer",
        )

        assert len(result) == 2
        assert result[0] == {
            "id": "abc123",
            "project.id": self.project.id,
            "issue.id": self.group.id,
            "timestamp": "2025-01-08T10:00:00Z",
        }
        assert result[1] == {
            "id": "def456",
            "project.id": self.project.id,
            "issue.id": self.group.id,
            "timestamp": "2025-01-08T09:00:00Z",
        }

    @mock.patch("sentry.api.helpers.events.Occurrences.run_table_query")
    def test_builds_correct_query_string(self, mock_run_table_query: mock.MagicMock) -> None:
        mock_run_table_query.return_value = {"data": []}

        get_events_for_group_eap(
            query="environment:production",
            snuba_params=self.snuba_params,
            group=self.group,
            limit=10,
            offset=0,
            orderby=None,
            referrer="test.referrer",
        )

        call_kwargs = mock_run_table_query.call_args.kwargs
        assert f"group_id:{self.group.id}" in call_kwargs["query_string"]
        assert "environment:production" in call_kwargs["query_string"]

    @mock.patch("sentry.api.helpers.events.Occurrences.run_table_query")
    def test_handles_sample_orderby(self, mock_run_table_query: mock.MagicMock) -> None:
        mock_run_table_query.return_value = {"data": []}

        get_events_for_group_eap(
            query="",
            snuba_params=self.snuba_params,
            group=self.group,
            limit=10,
            offset=0,
            orderby="sample",
            referrer="test.referrer",
        )

        call_kwargs = mock_run_table_query.call_args.kwargs
        assert call_kwargs["orderby"] == ["-timestamp", "id"]


class RunGroupEventsQueryTest(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.min_ago = before_now(minutes=1)

    @mock.patch("sentry.api.helpers.events.get_events_for_group_eap")
    @mock.patch("sentry.api.helpers.events.get_query_builder_for_group")
    def test_uses_snuba_as_source_of_truth(
        self,
        mock_get_query_builder: mock.MagicMock,
        mock_get_eap: mock.MagicMock,
    ) -> None:
        mock_query = mock.MagicMock()
        mock_query.run_query.return_value = {
            "data": [
                {
                    "id": "snuba123",
                    "project.id": 1,
                    "issue.id": 1,
                    "timestamp": "2025-01-08T10:00:00Z",
                }
            ]
        }
        mock_get_query_builder.return_value = mock_query

        mock_get_eap.return_value = [
            {"id": "eap456", "project.id": 1, "issue.id": 1, "timestamp": "2025-01-08T10:00:00Z"}
        ]

        group = self.create_group(project=self.project)
        snuba_params = SnubaParams(
            start=timezone.now() - timedelta(days=1),
            end=timezone.now(),
            environments=[],
            projects=[self.project],
            organization=self.organization,
        )

        with self.options({EAPOccurrencesComparator._should_eval_option_name(): True}):
            result = run_group_events_query(
                query="",
                snuba_params=snuba_params,
                group=group,
                limit=10,
                offset=0,
                orderby=None,
                referrer="test.referrer",
            )

        assert len(result) == 1
        assert result[0]["id"] == "snuba123"
        mock_get_query_builder.assert_called_once()
        mock_get_eap.assert_called_once()

    @mock.patch("sentry.api.helpers.events.get_events_for_group_eap")
    @mock.patch("sentry.api.helpers.events.get_query_builder_for_group")
    def test_uses_eap_when_in_allowlist(
        self,
        mock_get_query_builder: mock.MagicMock,
        mock_get_eap: mock.MagicMock,
    ) -> None:
        mock_query = mock.MagicMock()
        mock_query.run_query.return_value = {
            "data": [
                {
                    "id": "snuba123",
                    "project.id": 1,
                    "issue.id": 1,
                    "timestamp": "2025-01-08T10:00:00Z",
                }
            ]
        }
        mock_get_query_builder.return_value = mock_query

        mock_get_eap.return_value = [
            {"id": "eap456", "project.id": 1, "issue.id": 1, "timestamp": "2025-01-08T10:00:00Z"}
        ]

        group = self.create_group(project=self.project)
        snuba_params = SnubaParams(
            start=timezone.now() - timedelta(days=1),
            end=timezone.now(),
            environments=[],
            projects=[self.project],
            organization=self.organization,
        )

        with self.options(
            {
                EAPOccurrencesComparator._should_eval_option_name(): True,
                EAPOccurrencesComparator._callsite_allowlist_option_name(): [
                    "api.helpers.events.run_group_events_query"
                ],
            }
        ):
            result = run_group_events_query(
                query="",
                snuba_params=snuba_params,
                group=group,
                limit=10,
                offset=0,
                orderby=None,
                referrer="test.referrer",
            )

        assert len(result) == 1
        assert result[0]["id"] == "eap456"
        mock_get_query_builder.assert_called_once()
        mock_get_eap.assert_called_once()
