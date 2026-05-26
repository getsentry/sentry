from __future__ import annotations

import uuid
from typing import Any
from unittest import mock

from sentry.plugins.sentry_webhooks.plugin import WebHooksPlugin
from sentry.sentry_apps.services.legacy_webhook.service import (
    build_legacy_webhook_payload,
    get_triggering_rule_name,
)
from sentry.sentry_apps.services.legacy_webhook.validation import (
    compare_payloads,
    validate_payload_equivalence,
)
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestWebhookPayloadValidation(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(project=self.project)
        self.workflow = self.create_workflow(environment=self.environment)
        self.action = self.create_action(
            type=Action.Type.WEBHOOK,
            config={"target_identifier": "webhooks"},
        )
        self.group, self.event, self.group_event = self.create_group_event()
        self.event_data = WorkflowEventData(
            event=self.group_event, workflow_env=self.environment, group=self.group
        )
        self.invocation = ActionInvocation(
            event_data=self.event_data,
            action=self.action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=self.workflow.id,
        )

    def _build_old_payload(self) -> dict[str, Any]:
        rule_name = get_triggering_rule_name(self.invocation)
        return WebHooksPlugin().get_group_data(self.group, self.group_event, [rule_name])

    def _build_new_payload(self) -> dict[str, Any]:
        return dict(build_legacy_webhook_payload(self.invocation))

    def test_old_and_new_payloads_match(self) -> None:
        old = self._build_old_payload()
        new = self._build_new_payload()
        mismatches = compare_payloads(old, new)
        assert mismatches == []

    def test_detects_extra_field_in_new_payload(self) -> None:
        old = self._build_old_payload()
        new = self._build_new_payload()
        new["extra_field"] = "surprise"
        mismatches = compare_payloads(old, new)
        assert mismatches == ["Extra in new: extra_field"]

    def test_detects_missing_field_in_new_payload(self) -> None:
        old = self._build_old_payload()
        new = self._build_new_payload()
        del new["culprit"]
        mismatches = compare_payloads(old, new)
        assert mismatches == ["Missing from new: culprit"]

    def test_detects_nested_event_field_difference(self) -> None:
        old = self._build_old_payload()
        new = self._build_new_payload()
        new["event"]["event_id"] = "tampered"
        mismatches = compare_payloads(old, new)
        assert mismatches == ["event.event_id: old=str(len=32), new=str(len=8)"]

    @mock.patch("sentry.sentry_apps.services.legacy_webhook.validation.logger")
    def test_validate_logs_match_on_identical_payloads(self, mock_logger: mock.MagicMock) -> None:
        old = self._build_old_payload()
        new = self._build_new_payload()
        validate_payload_equivalence(
            old, new, organization_id=self.project.organization_id, project_id=self.project.id
        )
        mock_logger.info.assert_called_once_with(
            "legacy_webhook.validation.match",
            extra={
                "organization_id": self.project.organization_id,
                "project_id": self.project.id,
            },
        )

    @mock.patch("sentry.sentry_apps.services.legacy_webhook.validation.logger")
    def test_validate_logs_warnings_on_mismatch(self, mock_logger: mock.MagicMock) -> None:
        old = self._build_old_payload()
        new = self._build_new_payload()
        new["extra_field"] = "surprise"
        validate_payload_equivalence(
            old, new, organization_id=self.project.organization_id, project_id=self.project.id
        )
        mock_logger.warning.assert_called_once()
        assert mock_logger.warning.call_args[1]["extra"]["mismatches"] == [
            "Extra in new: extra_field"
        ]

    @mock.patch("sentry.sentry_apps.services.legacy_webhook.validation.logger")
    @mock.patch(
        "sentry.sentry_apps.services.legacy_webhook.validation.compare_payloads",
        side_effect=RuntimeError("boom"),
    )
    def test_validate_logs_exception_on_comparison_error(
        self, _mock_compare: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
        validate_payload_equivalence(
            {"a": 1},
            {"b": 2},
            organization_id=self.project.organization_id,
            project_id=self.project.id,
        )
        mock_logger.exception.assert_called_once_with(
            "legacy_webhook.validation.comparison_error",
            extra={
                "organization_id": self.project.organization_id,
                "project_id": self.project.id,
            },
        )
