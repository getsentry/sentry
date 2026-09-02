from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Any, ClassVar
from uuid import uuid4

from pydantic import BaseModel, Field

from sentry.seer.agent.client_models import SeerRunState


class ConsumeTask:
    """Instruction telling the worker when to queue a consume-feedback task."""

    Now: ClassVar[ConsumeTask]
    Later: ClassVar[type[_ConsumeLater]]

    def countdown(self) -> int | None:
        return None


class _ConsumeNow(ConsumeTask):
    pass


@dataclass(frozen=True)
class _ConsumeLater(ConsumeTask):
    when: timedelta

    def countdown(self) -> int | None:
        return max(0, int(self.when.total_seconds()))


ConsumeTask.Now = _ConsumeNow()
ConsumeTask.Later = _ConsumeLater


@dataclass(frozen=True)
class Decision:
    """`should_queue` and `should_consume` decisions

    `ok` decides whether the gate (`should_decision` and `should_queue`) resolves
    `reason` is purely for o11y, included as a tag in logs and metrics
    """

    ok: bool
    reason: str


@dataclass(frozen=True)
class TriggerDecision:
    """`should_trigger` decision with `reason` for o11y

    returns a `ConsumeTask` so we can either trigger now or queue up a trigger job for laters
    """

    task: ConsumeTask | None
    reason: str


class ConsumeTriggerSource:
    """Why ``consume_queued_autofix_feedback`` was scheduled.

    Passed through Celery kwargs so consume can log early-vs-later impact:
    feedback (webhook / UI / comment), a green check-suite pulling a parked
    defer forward, or the original 1h time-limit defer firing.
    """

    FEEDBACK = "feedback"
    GREEN_CHECK_SUITE_DEFER = "green_check_suite_defer"
    TIME_LIMIT_DEFER = "time_limit_defer"


class FeedbackSourceBase(BaseModel):
    class Config:
        extra = "ignore"

    # Always set. Provider-backed sources overwrite this with the provider's id;
    # sources with none (UI) keep the UUID minted here.
    source_id: str = Field(default_factory=lambda: str(uuid4()))

    @property
    def text(self) -> str:
        """Verbatim text passed to the explorer agent in the prompt."""
        raise NotImplementedError

    @property
    def ui_text(self) -> str | None:
        """Text shown in the UI. ``None`` means fall back to ``text``."""
        return None

    @property
    def is_automated(self) -> bool:
        """Whether this feedback came from an automated actor (CI, a bot).

        Consecutive automated-only iterations are capped.
        """
        return False

    def log_fields(self, run_state: SeerRunState) -> dict[str, Any]:
        """The inputs this source's gates read, for the caller logging a decision.

        Takes ``run_state`` because different fields in the run state are relevant depending
        on the feedback source, and we don't want to pollute logs with the whole run_state object.
        """
        return {}

    # A source that overrides none of these has nothing to check: its feedback is
    # queued, consumed, and triggered on arrival. ``no_gate`` says so explicitly,
    # which is worth distinguishing in a log from a gate that ran and passed.
    def should_queue(self, run_state: SeerRunState) -> Decision:
        return Decision(ok=True, reason="no_gate")

    def should_consume(self, run_state: SeerRunState) -> Decision:
        return Decision(ok=True, reason="no_gate")

    def should_trigger(self, run_state: SeerRunState) -> TriggerDecision:
        return TriggerDecision(task=ConsumeTask.Now, reason="no_gate")
