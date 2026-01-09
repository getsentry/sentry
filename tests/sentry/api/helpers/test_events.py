from __future__ import annotations

from datetime import timedelta
from typing import Any
from unittest import mock

from django.utils import timezone

from sentry.api.helpers.events import (
    _reasonable_group_events_match,
    get_events_for_group_eap,
    run_group_events_query,
)
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
        # sample orderby should fall back to -timestamp since EAP doesn't support column_hash
        assert call_kwargs["orderby"] == ["-timestamp"]


class ReasonableGroupEventsMatchTest(TestCase):
    def test_returns_true_for_matching_ids(self) -> None:
        snuba_data = [
            {"id": "abc123", "project.id": 1, "issue.id": 1, "timestamp": "2025-01-08T10:00:00Z"},
            {"id": "def456", "project.id": 1, "issue.id": 1, "timestamp": "2025-01-08T09:00:00Z"},
        ]
        eap_data = [
            {"id": "def456", "project.id": 1, "issue.id": 1, "timestamp": "2025-01-08T09:00:00Z"},
            {"id": "abc123", "project.id": 1, "issue.id": 1, "timestamp": "2025-01-08T10:00:00Z"},
        ]

        assert _reasonable_group_events_match(snuba_data, eap_data) is True

    def test_returns_true_for_eap_subset(self) -> None:
        """EAP may have less data during migration, subset is acceptable."""
        snuba_data = [
            {"id": "abc123", "project.id": 1, "issue.id": 1, "timestamp": "2025-01-08T10:00:00Z"},
            {"id": "def456", "project.id": 1, "issue.id": 1, "timestamp": "2025-01-08T09:00:00Z"},
        ]
        eap_data = [
            {"id": "abc123", "project.id": 1, "issue.id": 1, "timestamp": "2025-01-08T10:00:00Z"},
        ]

        assert _reasonable_group_events_match(snuba_data, eap_data) is True

    def test_returns_false_for_eap_has_extra_ids(self) -> None:
        """EAP should not have IDs that Snuba doesn't have."""
        snuba_data = [
            {"id": "abc123", "project.id": 1, "issue.id": 1, "timestamp": "2025-01-08T10:00:00Z"},
        ]
        eap_data = [
            {"id": "abc123", "project.id": 1, "issue.id": 1, "timestamp": "2025-01-08T10:00:00Z"},
            {"id": "xyz789", "project.id": 1, "issue.id": 1, "timestamp": "2025-01-08T09:00:00Z"},
        ]

        assert _reasonable_group_events_match(snuba_data, eap_data) is False

    def test_returns_false_for_different_ids(self) -> None:
        snuba_data = [
            {"id": "abc123", "project.id": 1, "issue.id": 1, "timestamp": "2025-01-08T10:00:00Z"},
        ]
        eap_data = [
            {"id": "xyz789", "project.id": 1, "issue.id": 1, "timestamp": "2025-01-08T10:00:00Z"},
        ]

        assert _reasonable_group_events_match(snuba_data, eap_data) is False

    def test_returns_true_for_empty_lists(self) -> None:
        assert _reasonable_group_events_match([], []) is True

    def test_returns_true_for_eap_empty_snuba_has_data(self) -> None:
        """Empty EAP is a subset of any Snuba result."""
        snuba_data = [
            {"id": "abc123", "project.id": 1, "issue.id": 1, "timestamp": "2025-01-08T10:00:00Z"},
        ]
        eap_data: list[dict[str, Any]] = []

        assert _reasonable_group_events_match(snuba_data, eap_data) is True


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
        # Setup snuba mock
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

        # Setup EAP mock
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

        # Should return snuba result (source of truth)
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
        # Setup snuba mock
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

        # Setup EAP mock
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

        # Should return EAP result when in allowlist
        assert len(result) == 1
        assert result[0]["id"] == "eap456"
        mock_get_query_builder.assert_called_once()
        mock_get_eap.assert_called_once()

    @mock.patch("sentry.api.helpers.events.get_events_for_group_eap")
    @mock.patch("sentry.api.helpers.events.get_query_builder_for_group")
    def test_skips_eap_when_experiment_disabled(
        self,
        mock_get_query_builder: mock.MagicMock,
        mock_get_eap: mock.MagicMock,
    ) -> None:
        # Setup snuba mock
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

        group = self.create_group(project=self.project)
        snuba_params = SnubaParams(
            start=timezone.now() - timedelta(days=1),
            end=timezone.now(),
            environments=[],
            projects=[self.project],
            organization=self.organization,
        )

        # EAP experiment disabled by default
        result = run_group_events_query(
            query="",
            snuba_params=snuba_params,
            group=group,
            limit=10,
            offset=0,
            orderby=None,
            referrer="test.referrer",
        )

        # Should return snuba result and NOT call EAP
        assert len(result) == 1
        assert result[0]["id"] == "snuba123"
        mock_get_query_builder.assert_called_once()
        mock_get_eap.assert_not_called()
