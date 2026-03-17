from __future__ import annotations

from unittest.mock import MagicMock, patch

from pydantic import ValidationError

from sentry.dashboards.on_completion_hook import DashboardOnCompletionHook
from sentry.seer.explorer.client_models import Artifact, MemoryBlock, Message, SeerRunState
from sentry.testutils.cases import TestCase


def _make_state(
    status: str = "completed",
    artifact_data: dict | None = None,
) -> SeerRunState:
    blocks = []
    if artifact_data is not None:
        blocks.append(
            MemoryBlock(
                id="block-1",
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

INVALID_ARTIFACT = {
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


class DashboardOnCompletionHookTest(TestCase):
    @patch("sentry.dashboards.on_completion_hook.fetch_run_status")
    def test_valid_artifact_passes(self, mock_fetch: MagicMock) -> None:
        mock_fetch.return_value = _make_state(artifact_data=VALID_ARTIFACT)

        with patch.object(DashboardOnCompletionHook, "_request_fix") as mock_fix:
            DashboardOnCompletionHook.execute(self.organization, run_id=1)
            mock_fix.assert_not_called()

    @patch("sentry.dashboards.on_completion_hook.fetch_run_status")
    def test_invalid_artifact_triggers_fix(self, mock_fetch: MagicMock) -> None:
        mock_fetch.return_value = _make_state(artifact_data=INVALID_ARTIFACT)

        with patch.object(DashboardOnCompletionHook, "_request_fix") as mock_fix:
            DashboardOnCompletionHook.execute(self.organization, run_id=1)
            mock_fix.assert_called_once()
            args = mock_fix.call_args
            assert args[0][0] == self.organization
            assert args[0][1] == 1
            assert isinstance(args[0][2], ValidationError)
