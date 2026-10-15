from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any
from unittest import mock

import orjson
import pytest
from slack_sdk.models.blocks import MarkdownTextObject, SectionBlock
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry.notifications.notification_action.utils import issue_notification_data_factory
from sentry.notifications.platform.shadow.capture import (
    LegacyRender,
    record_legacy_render,
    shadow_read,
)
from sentry.notifications.platform.shadow.compare import ShadowOutcome, _diff, _normalize
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.types import NotificationProviderKey, NotificationSource
from sentry.testutils.helpers.options import override_options
from sentry.workflow_engine.models import Action
from tests.sentry.notifications.platform.shadow.test_capture import (
    SAMPLE_ALL,
    ShadowInvocationTestCase,
    _send_legacy,
    shadow,
)

COMPARE_PATH = "sentry.notifications.platform.shadow.compare"


@dataclass
class ShadowObservation:
    results: list[dict[str, str]] = field(default_factory=list)
    result_logs: list[dict[str, Any]] = field(default_factory=list)
    compared: list[tuple[Any, Any]] = field(default_factory=list)

    @property
    def mismatch_logs(self) -> list[dict[str, Any]]:
        return [log for log in self.result_logs if log["outcome"] == ShadowOutcome.MISMATCH]

    @property
    def legacy_not_captured_logs(self) -> list[dict[str, Any]]:
        return [
            log for log in self.result_logs if log["outcome"] == ShadowOutcome.LEGACY_NOT_CAPTURED
        ]

    @property
    def result_log(self) -> dict[str, Any]:
        [log] = self.result_logs
        return log

    @property
    def payloads(self) -> tuple[Any, Any]:
        """
        The normalized legacy and platform payloads that were diffed.
        """
        [pair] = self.compared
        return pair

    @property
    def outcome(self) -> str:
        [result] = self.results
        return result["outcome"]

    @property
    def mismatch(self) -> dict[str, Any] | None:
        assert len(self.mismatch_logs) <= 1
        return self.mismatch_logs[0] if self.mismatch_logs else None


@contextmanager
def observe_shadow() -> Generator[ShadowObservation]:
    observation = ShadowObservation()
    with (
        mock.patch(f"{COMPARE_PATH}.metrics") as mock_metrics,
        mock.patch(f"{COMPARE_PATH}.logger") as mock_logger,
        mock.patch(f"{COMPARE_PATH}._diff", wraps=_diff) as mock_diff,
    ):
        try:
            yield observation
        finally:
            observation.compared = [
                (call.args[0], call.args[1]) for call in mock_diff.call_args_list
            ]
            observation.results = [
                call.kwargs["tags"]
                for call in mock_metrics.incr.call_args_list
                if call.args[0] == "notifications.platform.shadow.result"
            ]
            observation.result_logs = [
                call.kwargs["extra"]
                for call in mock_logger.info.call_args_list
                if call.args[0] == "notifications.platform.shadow.result"
            ]


def test_diff_excludes_values() -> None:
    legacy = {"text": "user@example.com", "tags": [{"value": "10.0.0.1"}], "level": "fatal"}
    platform = {"text": "other@example.com", "level": "warning"}
    entries = _diff(legacy, platform)

    assert entries == [
        "level: old=str(len=5), new=str(len=7)",
        "Missing from new: tags",
        "text: old=str(len=16), new=str(len=17)",
    ]
    for value in ("example.com", "10.0.0.1", "fatal", "warning"):
        assert all(value not in entry for entry in entries)


def test_normalize_slack_metric_json_string_attachments() -> None:
    attachment_blocks = [
        {"type": "section", "text": {"type": "mrkdwn", "text": "124 events\nStarted"}},
        {"type": "image", "image_url": "https://chart.example/1.png", "alt_text": "Chart"},
    ]
    legacy_attachments = orjson.dumps([{"blocks": attachment_blocks, "color": "#FF0000"}]).decode()
    legacy = _normalize(
        NotificationProviderKey.SLACK,
        {"attachments": legacy_attachments, "text": "<https://sentry.io|*Critical: Alert*>"},
    )
    platform = _normalize(
        NotificationProviderKey.SLACK,
        SlackRenderable(
            blocks=[],
            attachments=[{"blocks": attachment_blocks, "color": "#FF0000"}],
            text="<https://sentry.io|*Critical: Alert*>",
        ),
    )

    assert legacy == {
        "blocks": [],
        "attachments": [{"blocks": attachment_blocks, "color": "#FF0000"}],
        "text": "<https://sentry.io|*Critical: Alert*>",
    }
    assert legacy == platform


def test_normalize_slack_metric_surfaces_attachment_differences() -> None:
    legacy = _normalize(
        NotificationProviderKey.SLACK,
        {"attachments": orjson.dumps([{"blocks": [], "color": "#FF0000"}]).decode(), "text": "a"},
    )
    platform = _normalize(
        NotificationProviderKey.SLACK,
        SlackRenderable(blocks=[], attachments=[{"blocks": []}], text="a"),
    )
    assert legacy["attachments"] == [{"blocks": [], "color": "#FF0000"}]
    assert platform["attachments"] == [{"blocks": []}]


def test_normalize_slack_issue_blocks() -> None:
    blocks = [{"type": "section", "text": {"type": "mrkdwn", "text": "hello"}}]
    legacy = _normalize(
        NotificationProviderKey.SLACK,
        {"blocks": orjson.dumps(blocks).decode(), "text": "hello"},
    )
    platform = _normalize(
        NotificationProviderKey.SLACK_STAGING,
        SlackRenderable(
            blocks=[SectionBlock(text=MarkdownTextObject(text="hello"))],
            text="hello",
        ),
    )

    assert legacy == {"blocks": blocks, "attachments": [], "text": "hello"}
    assert legacy == platform


def test_normalize_slack_defaults_missing_keys() -> None:
    assert _normalize(NotificationProviderKey.SLACK, {}) == {
        "blocks": [],
        "attachments": [],
        "text": "",
    }


def test_normalize_msteams_strips_integration_id() -> None:
    card: dict[str, Any] = {
        "type": "AdaptiveCard",
        "body": [{"type": "TextBlock", "text": "Issue"}],
        "actions": [
            {
                "type": "Action.Submit",
                "data": {"actionType": "resolve", "integrationId": 1, "groupId": 2},
            },
            {
                "type": "Action.ShowCard",
                "card": {
                    "actions": [
                        {"type": "Action.Submit", "data": {"integrationId": 1, "groupId": 2}}
                    ]
                },
            },
        ],
    }
    normalized = _normalize(NotificationProviderKey.MSTEAMS, card)

    assert "integrationId" not in orjson.dumps(normalized).decode()
    assert normalized["actions"][0]["data"] == {"actionType": "resolve", "groupId": 2}
    assert normalized["actions"][1]["card"]["actions"][0]["data"] == {"groupId": 2}
    assert normalized["body"] == card["body"]
    assert card["actions"][0]["data"]["integrationId"] == 1


def test_normalize_leaves_discord_unchanged() -> None:
    message = {"content": "", "embeds": [{"title": "Error", "timestamp": "2026-09-24"}]}
    assert _normalize(NotificationProviderKey.DISCORD, message) is message


class ShadowReadOutcomeTest(ShadowInvocationTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options(SAMPLE_ALL))

    def test_legacy_not_captured(self) -> None:
        invocation = self.create_invocation()
        build_data = mock.Mock()

        with observe_shadow() as observation:
            with shadow_read(invocation, NotificationSource.ISSUE, build_data):
                pass

        assert observation.outcome == ShadowOutcome.LEGACY_NOT_CAPTURED
        build_data.assert_not_called()
        assert observation.mismatch is None
        assert observation.result_log == {
            "source": "issue",
            "provider": "slack",
            "variant": "issue:slack:error:event:no_tags:no_notes:unresolved:new:no_env:workflow:unassigned",
            "action_id": invocation.action.id,
            "workflow_id": self.workflow.id,
            "organization_id": self.organization.id,
            "group_id": self.issue_group.id,
            "detector_id": self.detector.id,
            "outcome": "legacy_not_captured",
            "integration_id": invocation.action.integration_id,
        }

    @mock.patch(
        f"{COMPARE_PATH}.NotificationService.render_template",
        return_value=({"type": "AdaptiveCard"}, set()),
    )
    def test_renders_the_data_built_from_the_legacy_render(
        self, mock_render: mock.MagicMock
    ) -> None:
        invocation = self.create_invocation(Action.Type.MSTEAMS)
        build_data = mock.Mock(return_value=issue_notification_data_factory(invocation))

        with observe_shadow() as observation:
            with shadow_read(invocation, NotificationSource.ISSUE, build_data):
                record_legacy_render(
                    NotificationProviderKey.MSTEAMS, {"type": "AdaptiveCard"}, chart_url="https://c"
                )

        assert observation.outcome == ShadowOutcome.MATCH, observation.mismatch
        build_data.assert_called_once_with(
            LegacyRender(
                provider=NotificationProviderKey.MSTEAMS,
                payload={"type": "AdaptiveCard"},
                chart_url="https://c",
            )
        )
        assert mock_render.call_args.kwargs["data"] is build_data.return_value

    @mock.patch(f"{COMPARE_PATH}.renderer_registry.get", return_value=None)
    @mock.patch(f"{COMPARE_PATH}.NotificationService.render_template")
    def test_no_renderer(self, mock_render: mock.MagicMock, mock_get: mock.MagicMock) -> None:
        with observe_shadow() as observation:
            with shadow(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
                _send_legacy()

        assert observation.outcome == ShadowOutcome.NO_RENDERER
        mock_render.assert_not_called()

    @mock.patch(f"{COMPARE_PATH}.sentry_sdk.capture_exception")
    @mock.patch(
        f"{COMPARE_PATH}.NotificationService.render_template", side_effect=RuntimeError("platform")
    )
    def test_platform_error_is_captured(
        self, mock_render: mock.MagicMock, mock_capture: mock.MagicMock
    ) -> None:
        with observe_shadow() as observation:
            with shadow(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
                _send_legacy()

        assert observation.outcome == ShadowOutcome.PLATFORM_ERROR
        mock_capture.assert_called_once_with(mock_render.side_effect)

    @mock.patch(f"{COMPARE_PATH}.sentry_sdk.capture_exception")
    @mock.patch(
        f"{COMPARE_PATH}.NotificationService.render_template",
        return_value=({"type": "AdaptiveCard"}, set()),
    )
    def test_compare_error_is_captured(
        self, mock_render: mock.MagicMock, mock_capture: mock.MagicMock
    ) -> None:
        with (
            observe_shadow() as observation,
            mock.patch(f"{COMPARE_PATH}._diff", side_effect=RuntimeError("compare")) as mock_diff,
        ):
            with shadow(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
                _send_legacy()

        assert observation.outcome == ShadowOutcome.COMPARE_ERROR
        mock_capture.assert_called_once_with(mock_diff.side_effect)

    @mock.patch(
        f"{COMPARE_PATH}.NotificationService.render_template",
        return_value=({"type": "AdaptiveCard"}, set()),
    )
    def test_match_records_timing(self, mock_render: mock.MagicMock) -> None:
        with mock.patch(f"{COMPARE_PATH}.metrics") as mock_metrics:
            with shadow(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
                _send_legacy()

        mock_metrics.timer.assert_called_once_with(
            "notifications.platform.shadow.duration",
            tags={"source": "issue", "provider": "msteams"},
            sample_rate=1.0,
        )
        mock_metrics.incr.assert_called_once_with(
            "notifications.platform.shadow.result",
            tags={"source": "issue", "provider": "msteams", "outcome": "match"},
            sample_rate=1.0,
        )

    @mock.patch(
        f"{COMPARE_PATH}.NotificationService.render_template",
        return_value=({"type": "Card", "extra": 1}, set()),
    )
    def test_mismatch_log(self, mock_render: mock.MagicMock) -> None:
        invocation = self.create_invocation(Action.Type.MSTEAMS)

        with observe_shadow() as observation:
            with shadow(invocation, NotificationSource.ISSUE):
                _send_legacy()

        assert observation.outcome == ShadowOutcome.MISMATCH
        assert observation.mismatch == {
            "source": "issue",
            "provider": "msteams",
            "variant": "issue:msteams:error:event:no_tags:no_notes:unresolved:new:no_env:workflow:unassigned",
            "action_id": invocation.action.id,
            "workflow_id": self.workflow.id,
            "organization_id": self.organization.id,
            "group_id": self.issue_group.id,
            "detector_id": self.detector.id,
            "outcome": "mismatch",
            "diff_count": 2,
            "diff": ["Extra in new: extra", "type: old=str(len=12), new=str(len=4)"],
            "has_releases": False,
            "has_chart": False,
        }

    @mock.patch(
        f"{COMPARE_PATH}.NotificationService.render_template",
        return_value=({"type": "AdaptiveCard"}, set()),
    )
    def test_match_log(self, mock_render: mock.MagicMock) -> None:
        self.project.flags.has_releases = True
        self.project.save()

        with observe_shadow() as observation:
            with shadow(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
                record_legacy_render(
                    NotificationProviderKey.MSTEAMS, {"type": "AdaptiveCard"}, chart_url="https://c"
                )

        log = observation.result_log
        assert log["outcome"] == "match"
        assert log["variant"].startswith("issue:msteams:error:")
        assert "diff" not in log
        assert log["has_releases"] is True
        assert log["has_chart"] is True
        assert "has_suggested_assignees" not in log

    @mock.patch(
        f"{COMPARE_PATH}.NotificationService.render_template", return_value=({"blocks": []}, set())
    )
    def test_slack_traits_are_read_from_the_legacy_payload(
        self, mock_render: mock.MagicMock
    ) -> None:
        blocks = [
            {"type": "context", "elements": [{"type": "mrkdwn", "text": "Suggested: #team"}]},
            {"type": "actions", "elements": [{"type": "button", "value": "root_cause"}]},
            {"type": "context", "elements": [{"type": "mrkdwn", "text": "<url|View Replays>"}]},
            {"type": "image", "image_url": "https://chart"},
        ]

        with observe_shadow() as observation:
            with shadow(self.create_invocation(Action.Type.SLACK), NotificationSource.ISSUE):
                record_legacy_render(NotificationProviderKey.SLACK, {"blocks": blocks})

        log = observation.result_log
        assert log["outcome"] == "mismatch"
        assert {key: log[key] for key in log if key.startswith("has_")} == {
            "has_releases": False,
            "has_chart": True,
            "has_suggested_assignees": True,
            "has_replay_link": True,
            "has_autofix_button": True,
        }

    @mock.patch(
        f"{COMPARE_PATH}.NotificationService.render_template", return_value=({"blocks": []}, set())
    )
    def test_traits_failure_still_logs_the_result(self, mock_render: mock.MagicMock) -> None:
        with (
            observe_shadow() as observation,
            mock.patch(f"{COMPARE_PATH}._render_traits", side_effect=RuntimeError("traits")),
        ):
            with shadow(self.create_invocation(Action.Type.SLACK), NotificationSource.ISSUE):
                record_legacy_render(NotificationProviderKey.SLACK, {"blocks": []})

        assert observation.result_log["outcome"] == "match"

    @mock.patch(
        f"{COMPARE_PATH}.NotificationService.render_template",
        return_value=({"type": "AdaptiveCard"}, set()),
    )
    def test_compares_when_the_send_raises(self, mock_render: mock.MagicMock) -> None:
        error = RuntimeError("send failed")

        with observe_shadow() as observation:
            with pytest.raises(RuntimeError) as excinfo:
                with shadow(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
                    _send_legacy()
                    raise error

        assert excinfo.value is error
        assert observation.outcome == ShadowOutcome.MATCH, observation.mismatch

    @mock.patch(
        f"{COMPARE_PATH}.NotificationService.render_template", side_effect=ValueError("platform")
    )
    def test_send_exception_is_not_replaced_by_a_shadow_error(
        self, mock_render: mock.MagicMock
    ) -> None:
        with observe_shadow() as observation:
            with pytest.raises(RuntimeError, match="send failed"):
                with shadow(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
                    _send_legacy()
                    raise RuntimeError("send failed")

        assert observation.outcome == ShadowOutcome.PLATFORM_ERROR

    @mock.patch(f"{COMPARE_PATH}.NotificationService.render_template")
    def test_no_compare_after_processing_deadline(self, mock_render: mock.MagicMock) -> None:
        with observe_shadow() as observation:
            with pytest.raises(ProcessingDeadlineExceeded):
                with shadow(self.create_invocation(), NotificationSource.ISSUE):
                    _send_legacy()
                    raise ProcessingDeadlineExceeded()

        assert observation.results == []
        mock_render.assert_not_called()

    def test_report_failure_does_not_propagate(self) -> None:
        with (
            mock.patch(f"{COMPARE_PATH}.metrics") as mock_metrics,
            mock.patch(f"{COMPARE_PATH}.logger") as mock_logger,
        ):
            mock_metrics.timer.side_effect = RuntimeError("statsd is down")
            with shadow(self.create_invocation(), NotificationSource.ISSUE):
                _send_legacy()

        mock_logger.exception.assert_called_once()
        assert (
            mock_logger.exception.call_args.args[0] == "notifications.platform.shadow.report_failed"
        )
