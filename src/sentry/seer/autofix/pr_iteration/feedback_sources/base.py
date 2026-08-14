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


@dataclass(frozen=True)
class Decision:
    """A yes/no gate on one feedback item, and the input that settled it.

    ``reason`` names what the gate actually read -- ``stale_head``,
    ``already_processed`` -- on the allow path as much as the deny path, so a
    caller logging the decision records why it went either way rather than only
    that it did. Values are drawn from a small fixed vocabulary per method so they
    are safe to use as a metric tag.
    """

    ok: bool
    reason: str


@dataclass(frozen=True)
class TriggerDecision:
    """When to run the consume task for a feedback item, and what settled it.

    ``task`` of ``None`` means not at all: the run has hit a limit, not that it is
    being deferred.
    """

    task: ConsumeTask | None
    reason: str


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

    # A source that overrides none of these has nothing to check: its feedback is
    # queued, consumed, and triggered on arrival. ``no_gate`` says so explicitly,
    # which is worth distinguishing in a log from a gate that ran and passed.
    def should_queue(self, run_state: SeerRunState) -> Decision:
        return Decision(ok=True, reason="no_gate")

    def should_consume(self, run_state: SeerRunState) -> Decision:
        return Decision(ok=True, reason="no_gate")

    def should_trigger(self, run_state: SeerRunState) -> TriggerDecision:
        return TriggerDecision(task=ConsumeTask.Now, reason="no_gate")
