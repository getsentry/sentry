from __future__ import annotations

import time
from unittest.mock import MagicMock, patch

import orjson

from fixtures.github import (
    CHECK_RUN_COMPLETED_EVENT_EXAMPLE,
    CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
)
from sentry.scm.types import CheckRunEvent, SubscriptionEvent
from sentry.seer.code_review.preflight import CodeReviewPreflightResult, PreflightDenialReason
from sentry.seer.code_review.webhooks.check_run import process_check_run
from sentry.testutils.cases import TestCase

REPO_EXTERNAL_ID = "35129377"


def _make_subscription_event(
    event_data: bytes,
    *,
    organization_id: int,
    integration_id: int,
    process_in_listener: bool = True,
) -> SubscriptionEvent:
    return SubscriptionEvent(
        received_at=int(time.time()),
        type="github",
        event_type_hint="check_run",
        event=event_data.decode("utf-8"),
        extra={
            "process_in_listener": process_in_listener,
            "organization_id": organization_id,
            "integration_id": integration_id,
        },
        sentry_meta=None,
    )


def _make_check_run_event(
    event_data: bytes,
    *,
    organization_id: int,
    integration_id: int,
    process_in_listener: bool = True,
) -> CheckRunEvent:
    parsed = orjson.loads(event_data)
    subscription_event = _make_subscription_event(
        event_data,
        organization_id=organization_id,
        integration_id=integration_id,
        process_in_listener=process_in_listener,
    )
    check_run = parsed["check_run"]
    return CheckRunEvent(
        action=parsed["action"],
        check_run={
            "external_id": check_run.get("external_id", ""),
            "html_url": check_run.get("html_url", ""),
        },
        subscription_event=subscription_event,
    )


class ProcessCheckRunTest(TestCase):
    """Tests for the process_check_run SCM event stream listener."""

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="12345",
            provider="github",
        )
        self.repo = self.create_repo(
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            external_id=REPO_EXTERNAL_ID,
        )

    @patch("sentry.seer.code_review.webhooks.check_run.CodeReviewPreflightService")
    @patch("sentry.seer.code_review.webhooks.task.process_github_webhook_event")
    def test_base_case(self, mock_task: MagicMock, mock_preflight_cls: MagicMock) -> None:
        mock_preflight_cls.return_value.check.return_value = CodeReviewPreflightResult(allowed=True)
        event = _make_check_run_event(
            CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
            organization_id=self.organization.id,
            integration_id=self.integration.id,
        )

        process_check_run(event)

        mock_task.delay.assert_called_once()
        call_kwargs = mock_task.delay.call_args[1]
        assert call_kwargs["event_payload"]["original_run_id"] == "4663713"

    @patch("sentry.seer.code_review.webhooks.check_run.CodeReviewPreflightService")
    @patch("sentry.seer.code_review.webhooks.task.process_github_webhook_event")
    def test_skips_when_process_in_listener_not_set(
        self, mock_task: MagicMock, mock_preflight_cls: MagicMock
    ) -> None:
        event = _make_check_run_event(
            CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            process_in_listener=False,
        )

        process_check_run(event)

        mock_task.delay.assert_not_called()
        mock_preflight_cls.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.check_run.CodeReviewPreflightService")
    @patch("sentry.seer.code_review.webhooks.task.process_github_webhook_event")
    def test_skips_unsupported_action(
        self, mock_task: MagicMock, mock_preflight_cls: MagicMock
    ) -> None:
        event = _make_check_run_event(
            CHECK_RUN_COMPLETED_EVENT_EXAMPLE,
            organization_id=self.organization.id,
            integration_id=self.integration.id,
        )

        process_check_run(event)

        mock_task.delay.assert_not_called()
        mock_preflight_cls.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.check_run.CodeReviewPreflightService")
    @patch("sentry.seer.code_review.webhooks.task.process_github_webhook_event")
    def test_enqueues_task_with_correct_parameters(
        self, mock_task: MagicMock, mock_preflight_cls: MagicMock
    ) -> None:
        mock_preflight_cls.return_value.check.return_value = CodeReviewPreflightResult(allowed=True)
        event = _make_check_run_event(
            CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
            organization_id=self.organization.id,
            integration_id=self.integration.id,
        )

        process_check_run(event)

        mock_preflight_cls.assert_called_once_with(
            organization=self.organization,
            repo=self.repo,
            integration_id=self.integration.id,
            pr_author_external_id="12345678",
        )
        mock_task.delay.assert_called_once()
        call_kwargs = mock_task.delay.call_args[1]
        assert call_kwargs["seer_path"] == "/v1/code_review/check/rerun"
        assert call_kwargs["event_payload"] == {"original_run_id": "4663713"}
        assert call_kwargs["tags"]["sentry_organization_id"] == str(self.organization.id)
        assert call_kwargs["tags"]["sentry_integration_id"] == str(self.integration.id)

    @patch("sentry.seer.code_review.webhooks.check_run.CodeReviewPreflightService")
    @patch("sentry.seer.code_review.webhooks.task.process_github_webhook_event")
    def test_skips_when_preflight_denied(
        self, mock_task: MagicMock, mock_preflight_cls: MagicMock
    ) -> None:
        mock_preflight_cls.return_value.check.return_value = CodeReviewPreflightResult(
            allowed=False,
            denial_reason=PreflightDenialReason.ORG_LEGAL_AI_CONSENT_NOT_GRANTED,
        )
        event = _make_check_run_event(
            CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
            organization_id=self.organization.id,
            integration_id=self.integration.id,
        )

        process_check_run(event)

        mock_task.delay.assert_not_called()
