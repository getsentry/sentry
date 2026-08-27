from __future__ import annotations

from dataclasses import field
from typing import Literal

from sentry import analytics

PrIterationTriggerSource = Literal["check-suite"]

PrIterationTriggerSchedule = Literal["now", "later"]

PrIterationOutcome = Literal[
    "code_changes_pushed",
    "no_code_changes",
    "push_failed",
    "agent_timeout",
    "agent_error",
    "no_iteration",
    "unknown",
]

PrIterationFailureStage = Literal["none", "agent", "push"]


@analytics.eventclass()
class AiAutofixPrIterationDetailsBaseEvent(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    run_id: int
    consume_id: str | None = None
    referrer: str | None = None


@analytics.eventclass("ai.autofix.pr_iteration.details.started")
class AiAutofixPrIterationDetailsStartedEvent(AiAutofixPrIterationDetailsBaseEvent):
    trigger_head_sha: str | None = None
    feedback_received_at: str | None = None


@analytics.eventclass("ai.autofix.pr_iteration.details.completed")
class AiAutofixPrIterationDetailsCompletedEvent(AiAutofixPrIterationDetailsBaseEvent):
    repository_id: int | None = None
    pull_request_id: int | None = None
    repository_provider: str | None = None
    enabled_flags: list[str] = field(default_factory=list)

    iteration_index: int | None = None
    consecutive_automated_iterations: int = 0

    trigger_source: PrIterationTriggerSource = "check-suite"  # for now
    trigger_feedback_count: int = 0
    trigger_head_sha: str | None = None

    trigger_schedule: PrIterationTriggerSchedule = "now"
    trigger_schedule_reason: str | None = None
    trigger_delay_seconds: int | None = None

    feedback_first_received_at: str | None = None
    feedback_last_received_at: str | None = None
    triggered_at: str | None = None
    consumed_at: str | None = None
    ended_at: str | None = None
    duration_ms: int | None = None

    outcome: PrIterationOutcome = "unknown"
    outcome_detail: str | None = None
    failure_stage: PrIterationFailureStage = "none"
    run_status: str | None = None

    result_head_sha: str | None = None
    files_changed: int = 0
    lines_added: int = 0
    lines_removed: int = 0
    has_workflow_patches: bool = False

    tool_calls_total: int = 0
    tool_calls_failed: int = 0
    tool_calls_failed_by_name: str = "{}"

    missing_permission_scopes: list[str] = field(default_factory=list)
    push_error_code: str | None = None
    no_patch_reason: str | None = None


analytics.register(AiAutofixPrIterationDetailsStartedEvent)
analytics.register(AiAutofixPrIterationDetailsCompletedEvent)
