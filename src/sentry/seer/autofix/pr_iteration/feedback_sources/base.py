from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import ClassVar

from pydantic import BaseModel

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
        """Whether this feedback came from an automated actor (CI, a bot) rather
        than a human.

        Consecutive iterations driven only by automated feedback are capped (see
        ``automated_iteration_cap_reached``); human feedback resets that streak.
        Defaults to human — subclasses opt in.
        """
        return False

    def should_queue(self, run_state: SeerRunState) -> bool:
        return True

    def should_consume(self, run_state: SeerRunState) -> bool:
        return True

    def should_trigger(self, run_state: SeerRunState) -> ConsumeTask | None:
        return ConsumeTask.Now
