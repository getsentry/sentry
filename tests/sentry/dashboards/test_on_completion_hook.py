from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

from sentry.dashboards.models.generate_dashboard_artifact import GeneratedDashboard
from sentry.dashboards.on_completion_hook import (
    FIX_PROMPT,
    FIX_PROMPT_SECONDARY,
    MAX_VALIDATION_RETRIES,
    DashboardOnCompletionHook,
    _format_serializer_errors,
    _validate_with_serializer,
)
from sentry.seer.agent.client_models import Artifact, MemoryBlock, Message, SeerRunState
from sentry.testutils.cases import TestCase


def _make_state(
    status: str = "completed",
    artifact_data: dict | None = None,
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


class DashboardOnCompletionHookTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project

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
