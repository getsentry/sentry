from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from sentry.api.client import ApiError
from sentry.dashboards.models.generate_dashboard_artifact import (
    GeneratedDashboard,
    GeneratedWidgetQuery,
)
from sentry.dashboards.on_completion_hook import (
    FIX_PROMPT,
    FIX_PROMPT_SECONDARY,
    MAX_VALIDATION_RETRIES,
    DashboardOnCompletionHook,
    _build_widget_request,
    _dry_run_widget_queries,
    _format_serializer_errors,
    _validate_with_serializer,
)
from sentry.search.events.constants import TIMEOUT_RPC_ERROR_MESSAGE
from sentry.seer.agent.client_models import Artifact, MemoryBlock, Message, SeerRunState
from sentry.seer.models.run import SeerRun
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.users.services.user.service import user_service


def _make_state(
    status: str = "completed",
    artifact_data: dict[str, Any] | None = None,
    previous_blocks: list[MemoryBlock] | None = None,
) -> SeerRunState:
    blocks: list[MemoryBlock] = list(previous_blocks or [])
    if artifact_data is not None:
        blocks.append(
            MemoryBlock(
                id="block-artifact",
                message=Message(role="assistant", content="Done"),
                timestamp="2026-01-01T00:00:00Z",
                artifacts=[Artifact(key="dashboard", data=artifact_data, reason="generated")],
            )
        )
    return SeerRunState(
        run_id=1,
        blocks=blocks,
        status=status,
        updated_at="2026-01-01T00:00:00Z",
    )


VALID_ARTIFACT = {
    "title": "Test Dashboard",
    "widgets": [
        {
            "title": "Error Count",
            "description": "Count of errors",
            "display_type": "line",
            "widget_type": "spans",
            "queries": [
                {
                    "aggregates": ["count()"],
                    "columns": [],
                }
            ],
            "layout": {"x": 0, "y": 0, "w": 3, "h": 2, "min_h": 2},
        }
    ],
}

INVALID_PYDANTIC_ARTIFACT = {
    "title": "Test Dashboard",
    "widgets": [
        {
            "title": "Bad Widget",
            "description": "Uses invalid function",
            "display_type": "line",
            "widget_type": "spans",
            "queries": [
                {
                    "aggregates": ["spm()"],
                    "columns": [],
                }
            ],
            "layout": {"x": 0, "y": 0, "w": 3, "h": 2, "min_h": 2},
        }
    ],
}

INVALID_SERIALIZER_ARTIFACT = {
    "title": "Test Dashboard",
    "widgets": [
        {
            "title": "Bad Widget",
            "description": "Uses nonexistent aggregate",
            "display_type": "line",
            "widget_type": "error-events",
            "queries": [
                {
                    "aggregates": ["nonexistent_function()"],
                    "columns": [],
                }
            ],
            "layout": {"x": 0, "y": 0, "w": 3, "h": 2, "min_h": 2},
        }
    ],
}


def _make_artifact(**widget_overrides: Any) -> GeneratedDashboard:
    """Build a minimal valid GeneratedDashboard, applying widget_overrides to the first widget."""
    widget: dict[str, Any] = {
        "title": "Widget",
        "description": "",
        "display_type": "line",
        "widget_type": "error-events",
        "queries": [{"aggregates": ["count()"], "columns": []}],
        "layout": {"x": 0, "y": 0, "w": 3, "h": 2, "min_h": 2},
        **widget_overrides,
    }
    return GeneratedDashboard(title="Dashboard", widgets=[widget])


def test_generated_widget_rejects_height_below_display_type_minimum() -> None:
    with pytest.raises(ValidationError, match="Height must be at least 2 for line widgets"):
        _make_artifact(layout={"x": 0, "y": 0, "w": 3, "h": 1, "min_h": 1})


def test_generated_widget_derives_min_height_from_display_type() -> None:
    artifact = _make_artifact(
        display_type="big_number",
        layout={"x": 0, "y": 0, "w": 2, "h": 1, "min_h": 2},
    )

    assert artifact.widgets[0].layout.min_h == 1


def test_generated_widget_rejects_unsupported_issue_chart_aggregate() -> None:
    with pytest.raises(ValidationError, match=r"Unsupported aggregates \['count\(\)'\]"):
        _make_artifact(widget_type="issue")


def test_generated_widget_allows_supported_issue_chart_aggregates() -> None:
    artifact = _make_artifact(
        widget_type="issue",
        queries=[{"aggregates": ["count(new_issues)", "count(resolved_issues)"]}],
    )

    assert artifact.widgets[0].queries[0].aggregates == [
        "count(new_issues)",
        "count(resolved_issues)",
    ]


class TestFormatSerializerErrors(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project  # ensure an active project exists for _validate_with_serializer

    def _real_errors(self, artifact: GeneratedDashboard) -> dict[str, Any]:
        errors = _validate_with_serializer(artifact, self.organization)
        assert errors is not None, "expected validation to fail but it passed"
        return errors

    def test_empty_errors_fallback(self) -> None:
        assert _format_serializer_errors({}) == str({})

    def test_query_level_error(self) -> None:
        # nonexistent_function() is not blocklisted by Pydantic, but DRF rejects it.
        artifact = _make_artifact(queries=[{"aggregates": ["nonexistent_fn()"], "columns": []}])
        errors = self._real_errors(artifact)
        result = _format_serializer_errors(errors)
        assert result.startswith("Widget 0, query 0, fields:")
        assert "nonexistent_fn" in result

    def test_valid_widget_emits_empty_dict_which_is_skipped(self) -> None:
        # DRF emits {} for error-free list items; only widget 1 should appear in output.
        valid_widget: dict[str, Any] = {
            "title": "Valid",
            "description": "",
            "display_type": "line",
            "widget_type": "error-events",
            "queries": [{"aggregates": ["count()"], "columns": []}],
            "layout": {"x": 0, "y": 0, "w": 3, "h": 2, "min_h": 2},
        }
        bad_widget: dict[str, Any] = {
            "title": "Bad",
            "description": "",
            "display_type": "line",
            "widget_type": "error-events",
            "queries": [{"aggregates": ["bad_fn()"], "columns": []}],
            "layout": {"x": 3, "y": 0, "w": 3, "h": 2, "min_h": 2},
        }
        artifact = GeneratedDashboard(title="Dashboard", widgets=[valid_widget, bad_widget])
        errors = self._real_errors(artifact)
        result = _format_serializer_errors(errors)
        assert "Widget 0" not in result
        assert result.startswith("Widget 1, query 0, fields:")
        assert "bad_fn" in result


def test_build_widget_request_table_queries_events() -> None:
    widget = _make_artifact(
        display_type="table",
        widget_type="spans",
        queries=[{"columns": ["span.op"], "aggregates": ["count()"], "orderby": "-count()"}],
    ).widgets[0]

    assert _build_widget_request(widget, widget.queries[0]) == (
        "events",
        {
            "dataset": "spans",
            "query": "",
            "sampling": "NORMAL",
            "field": ["span.op", "count()"],
            "per_page": 1,
            "sort": "-count()",
        },
    )


def test_build_widget_request_grouped_chart_queries_top_events() -> None:
    widget = _make_artifact(
        display_type="bar",
        limit=10,
        queries=[{"columns": ["release"], "aggregates": ["count()"], "orderby": "-count()"}],
    ).widgets[0]

    assert _build_widget_request(widget, widget.queries[0]) == (
        "events-timeseries",
        {
            "dataset": "errors",
            "query": "",
            "yAxis": ["count()"],
            "interval": "1m",
            "field": ["release", "count()"],
            "groupBy": ["release", "count()"],
            "topEvents": 10,
            "sort": "-count()",
        },
    )


def test_build_widget_request_grouped_chart_groups_by_unselected_sort() -> None:
    widget = _make_artifact(
        display_type="line",
        widget_type="spans",
        queries=[
            {
                "columns": ["span.op"],
                "aggregates": ["avg(span.duration)"],
                "orderby": "-count()",
            }
        ],
    ).widgets[0]

    request = _build_widget_request(widget, widget.queries[0])

    assert request is not None
    _, params = request
    assert params["field"] == ["span.op", "avg(span.duration)", "count()"]
    assert params["groupBy"] == ["span.op", "avg(span.duration)", "count()"]
    assert params["sort"] == "-count()"


def test_build_widget_request_issue_widget_queries_issues() -> None:
    widget = _make_artifact(
        display_type="table",
        widget_type="issue",
        queries=[{"conditions": "is:unresolved", "orderby": "freq"}],
    ).widgets[0]

    assert _build_widget_request(widget, widget.queries[0]) == (
        "issues",
        {"query": "is:unresolved", "limit": 1, "sort": "freq"},
    )


def test_build_widget_request_issue_chart_queries_issues_timeseries() -> None:
    widget = _make_artifact(
        display_type="line",
        widget_type="issue",
        queries=[{"conditions": "is:unresolved", "aggregates": ["count(new_issues)"]}],
    ).widgets[0]

    assert _build_widget_request(widget, widget.queries[0]) == (
        "issues-timeseries",
        {
            "query": "is:unresolved",
            "yAxis": ["count(new_issues)"],
            "interval": "1m",
            "category": "issue",
        },
    )


def test_build_widget_request_skips_text_widgets() -> None:
    widget = _make_artifact(display_type="text", widget_type=None, queries=[]).widgets[0]
    assert _build_widget_request(widget, GeneratedWidgetQuery()) is None


class DryRunWidgetQueriesTest(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project
        owner = user_service.get_user(user_id=self.user.id)
        assert owner is not None
        self.owner = owner

    def test_valid_queries_return_no_errors(self) -> None:
        artifact = GeneratedDashboard(
            title="Dashboard",
            widgets=[
                {
                    "title": "Errors",
                    "description": "",
                    "display_type": "line",
                    "widget_type": "error-events",
                    "queries": [{"aggregates": ["count()"]}],
                    "layout": {"x": 0, "y": 0, "w": 3, "h": 2},
                },
                {
                    "title": "Unresolved issues",
                    "description": "",
                    "display_type": "table",
                    "widget_type": "issue",
                    "queries": [{"conditions": "is:unresolved", "orderby": "freq"}],
                    "layout": {"x": 3, "y": 0, "w": 3, "h": 2},
                },
            ],
        )

        assert _dry_run_widget_queries(artifact, self.organization, self.owner) == []

    def test_logs_sort_outside_selected_columns_is_reported(self) -> None:
        artifact = _make_artifact(
            title="Recent logs",
            display_type="table",
            widget_type="logs",
            queries=[{"columns": ["message"], "aggregates": [], "orderby": "-timestamp"}],
        )

        assert _validate_with_serializer(artifact, self.organization) is None
        assert _dry_run_widget_queries(artifact, self.organization, self.owner) == [
            "Widget 0 ('Recent logs'), query 0: orderby must also be in the selected columns or groupby"
        ]

    def test_invalid_issue_search_value_is_reported(self) -> None:
        artifact = _make_artifact(
            title="ANRs",
            display_type="table",
            widget_type="issue",
            queries=[{"conditions": "is:unresolved issue.category:anr", "orderby": "freq"}],
        )

        assert _validate_with_serializer(artifact, self.organization) is None
        assert _dry_run_widget_queries(artifact, self.organization, self.owner) == [
            "Widget 0 ('ANRs'), query 0: Error parsing search query: Invalid category value of 'anr'"
        ]

    def test_grouped_chart_sorted_by_unselected_aggregate_passes(self) -> None:
        artifact = _make_artifact(
            display_type="line",
            widget_type="spans",
            queries=[
                {
                    "columns": ["span.op"],
                    "aggregates": ["avg(span.duration)"],
                    "orderby": "-count()",
                }
            ],
        )

        assert _dry_run_widget_queries(artifact, self.organization, self.owner) == []

    def test_runs_with_the_owners_access(self) -> None:
        outsider = user_service.get_user(user_id=self.create_user().id)
        assert outsider is not None
        artifact = _make_artifact(
            display_type="table",
            widget_type="issue",
            queries=[{"conditions": "is:unresolved issue.category:anr", "orderby": "freq"}],
        )

        # A user outside the org gets a 403, not the query's 400, so nothing is reported.
        assert _dry_run_widget_queries(artifact, self.organization, outsider) == []

    def test_non_400_failures_are_skipped(self) -> None:
        with patch(
            "sentry.dashboards.on_completion_hook.ApiClient.get",
            side_effect=ApiError(500, {"detail": "Internal error"}),
        ):
            assert _dry_run_widget_queries(_make_artifact(), self.organization, self.owner) == []

    def test_issue_chart_ignores_conditions_the_chart_endpoint_ignores(self) -> None:
        artifact = _make_artifact(
            display_type="line",
            widget_type="issue",
            queries=[
                {
                    "conditions": "is:unresolved issue.category:anr",
                    "aggregates": ["count(new_issues)"],
                }
            ],
        )

        assert _dry_run_widget_queries(artifact, self.organization, self.owner) == []

    def test_stops_when_the_time_budget_runs_out(self) -> None:
        with (
            patch("sentry.dashboards.on_completion_hook.DRY_RUN_TIME_BUDGET_SECONDS", 0),
            patch("sentry.dashboards.on_completion_hook.ApiClient.get") as mock_get,
        ):
            assert _dry_run_widget_queries(_make_artifact(), self.organization, self.owner) == []
        mock_get.assert_not_called()

    def test_query_timeouts_are_skipped(self) -> None:
        with patch(
            "sentry.dashboards.on_completion_hook.ApiClient.get",
            side_effect=ApiError(400, {"detail": TIMEOUT_RPC_ERROR_MESSAGE}),
        ):
            assert _dry_run_widget_queries(_make_artifact(), self.organization, self.owner) == []


class DashboardOnCompletionHookTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project
        self.create_seer_run(
            organization=self.organization, user_id=self.user.id, seer_run_state_id=1
        )
        dry_run = patch(
            "sentry.dashboards.on_completion_hook._dry_run_widget_queries", return_value=[]
        )
        self.mock_dry_run = dry_run.start()
        self.addCleanup(dry_run.stop)

    @patch("sentry.dashboards.on_completion_hook.fetch_run_status")
    def test_valid_artifact_passes(self, mock_fetch: MagicMock) -> None:
        mock_fetch.return_value = _make_state(artifact_data=VALID_ARTIFACT)

        with patch.object(DashboardOnCompletionHook, "_request_fix") as mock_fix:
            DashboardOnCompletionHook.execute(self.organization, run_id=1)
            mock_fix.assert_not_called()

    @patch("sentry.dashboards.on_completion_hook.fetch_run_status")
    def test_invalid_pydantic_artifact_triggers_fix(self, mock_fetch: MagicMock) -> None:
        mock_fetch.return_value = _make_state(artifact_data=INVALID_PYDANTIC_ARTIFACT)

        with patch.object(DashboardOnCompletionHook, "_request_fix") as mock_fix:
            DashboardOnCompletionHook.execute(self.organization, run_id=1)
            mock_fix.assert_called_once()
            args = mock_fix.call_args
            assert args[0][0] == self.organization
            assert args[0][1] == 1
            assert isinstance(args[0][2], str)
            assert "spm" in args[0][2]

    @patch("sentry.dashboards.on_completion_hook.fetch_run_status")
    def test_invalid_serializer_artifact_triggers_fix(self, mock_fetch: MagicMock) -> None:
        """An artifact that passes Pydantic but fails the DRF serializer should trigger a fix."""
        mock_fetch.return_value = _make_state(artifact_data=INVALID_SERIALIZER_ARTIFACT)

        with patch.object(DashboardOnCompletionHook, "_request_fix") as mock_fix:
            DashboardOnCompletionHook.execute(self.organization, run_id=1)
            mock_fix.assert_called_once()
            args = mock_fix.call_args
            assert args[0][0] == self.organization
            assert args[0][1] == 1
            assert isinstance(args[0][2], str)

    @patch("sentry.dashboards.on_completion_hook.fetch_run_status")
    def test_valid_artifact_after_prior_fix_still_passes(self, mock_fetch: MagicMock) -> None:
        """Validation should still run and pass even if a fix was previously requested."""
        block = MemoryBlock(
            id="block-fix",
            message=Message(
                role="user",
                content=f"{FIX_PROMPT} {FIX_PROMPT_SECONDARY}",
            ),
            timestamp="2026-01-01T00:00:01Z",
        )
        mock_fetch.return_value = _make_state(
            artifact_data=VALID_ARTIFACT,
            previous_blocks=[block],
        )

        with patch.object(DashboardOnCompletionHook, "_request_fix") as mock_fix:
            DashboardOnCompletionHook.execute(self.organization, run_id=1)
            mock_fix.assert_not_called()

    @patch("sentry.dashboards.on_completion_hook.fetch_run_status")
    def test_max_retries_prevents_infinite_loop(self, mock_fetch: MagicMock) -> None:
        """After MAX_VALIDATION_RETRIES consecutive fix requests, stop retrying."""
        # Simulate: fix → response → fix → response → ... (3 fix prompts with
        # assistant responses in between). Only user fix blocks count; assistant
        # blocks are skipped when scanning backwards.
        blocks: list[MemoryBlock] = []
        for i in range(MAX_VALIDATION_RETRIES):
            blocks.append(
                MemoryBlock(
                    id=f"block-fix-{i}",
                    message=Message(
                        role="user",
                        content=f"{FIX_PROMPT} {FIX_PROMPT_SECONDARY}",
                    ),
                    timestamp=f"2026-01-01T00:00:0{i}Z",
                )
            )
        mock_fetch.return_value = _make_state(
            artifact_data=INVALID_PYDANTIC_ARTIFACT,
            previous_blocks=blocks,
        )

        with patch.object(DashboardOnCompletionHook, "_request_fix") as mock_fix:
            DashboardOnCompletionHook.execute(self.organization, run_id=1)
            mock_fix.assert_not_called()

    @patch("sentry.dashboards.on_completion_hook.fetch_run_status")
    def test_retry_count_resets_after_user_message(self, mock_fetch: MagicMock) -> None:
        """A non-fix user message resets the retry counter so new failures get fresh retries."""
        blocks: list[MemoryBlock] = []
        for i in range(MAX_VALIDATION_RETRIES):
            blocks.append(
                MemoryBlock(
                    id=f"block-fix-old-{i}",
                    message=Message(
                        role="user",
                        content=f"{FIX_PROMPT} {FIX_PROMPT_SECONDARY}",
                    ),
                    timestamp=f"2026-01-01T00:00:0{i}Z",
                )
            )
        blocks.append(
            MemoryBlock(
                id="block-user-continue",
                message=Message(role="user", content="Now add a latency widget"),
                timestamp="2026-01-01T00:00:04Z",
            )
        )
        mock_fetch.return_value = _make_state(
            artifact_data=INVALID_PYDANTIC_ARTIFACT,
            previous_blocks=blocks,
        )

        with patch.object(DashboardOnCompletionHook, "_request_fix") as mock_fix:
            DashboardOnCompletionHook.execute(self.organization, run_id=1)
            mock_fix.assert_called_once()

    @patch("sentry.dashboards.on_completion_hook.fetch_run_status")
    def test_query_dry_run_errors_trigger_fix(self, mock_fetch: MagicMock) -> None:
        """An artifact that passes both validators but fails when its queries run should trigger a fix."""
        mock_fetch.return_value = _make_state(artifact_data=VALID_ARTIFACT)
        self.mock_dry_run.return_value = [
            "Widget 0 ('Error Count'), query 0: Invalid characters in field total_delay_ms,number"
        ]

        with patch.object(DashboardOnCompletionHook, "_request_fix") as mock_fix:
            DashboardOnCompletionHook.execute(self.organization, run_id=1)
            mock_fix.assert_called_once_with(
                self.organization,
                1,
                "Widget 0 ('Error Count'), query 0: Invalid characters in field total_delay_ms,number",
            )

    @patch("sentry.dashboards.on_completion_hook.fetch_run_status")
    def test_query_dry_run_runs_as_the_run_owner(self, mock_fetch: MagicMock) -> None:
        mock_fetch.return_value = _make_state(artifact_data=VALID_ARTIFACT)

        DashboardOnCompletionHook.execute(self.organization, run_id=1)

        self.mock_dry_run.assert_called_once()
        assert self.mock_dry_run.call_args[0][2].id == self.user.id

    @patch("sentry.dashboards.on_completion_hook.fetch_run_status")
    def test_query_dry_run_skipped_without_run_owner(self, mock_fetch: MagicMock) -> None:
        mock_fetch.return_value = _make_state(artifact_data=VALID_ARTIFACT)
        SeerRun.objects.filter(seer_run_state_id=1).update(user_id=None)

        with patch.object(DashboardOnCompletionHook, "_request_fix") as mock_fix:
            DashboardOnCompletionHook.execute(self.organization, run_id=1)
            mock_fix.assert_not_called()

        self.mock_dry_run.assert_not_called()

    @patch("sentry.dashboards.on_completion_hook.fetch_run_status")
    def test_query_dry_run_skipped_when_serializer_fails(self, mock_fetch: MagicMock) -> None:
        mock_fetch.return_value = _make_state(artifact_data=INVALID_SERIALIZER_ARTIFACT)

        with patch.object(DashboardOnCompletionHook, "_request_fix"):
            DashboardOnCompletionHook.execute(self.organization, run_id=1)

        self.mock_dry_run.assert_not_called()
