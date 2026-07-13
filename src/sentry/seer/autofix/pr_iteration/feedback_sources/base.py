from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import cached_property
from typing import ClassVar, NewType

from django.utils import timezone
from pydantic import BaseModel

from sentry.seer.agent.client_models import SeerRunState

# Type alias for timezone-aware datetimes. This provides static type checking to
# distinguish aware from naive datetimes. Use timezone.now() or timezone.make_aware()
# to create instances.
AwareDatetime = NewType("AwareDatetime", datetime)


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
    when: timedelta | AwareDatetime

    def __post_init__(self) -> None:
        # Runtime validation as a safety net, though mypy should catch this statically.
        if isinstance(self.when, datetime) and timezone.is_naive(self.when):
            raise ValueError(
                "ConsumeTask.Later requires a timezone-aware datetime. "
                "Use timezone.now() or timezone.make_aware() instead of "
                "datetime.now() or datetime.utcnow()."
            )

    def countdown(self) -> int | None:
        if isinstance(self.when, timedelta):
            seconds = self.when.total_seconds()
        else:
            seconds = (self.when - timezone.now()).total_seconds()
        return max(0, int(seconds))


ConsumeTask.Now = _ConsumeNow()
ConsumeTask.Later = _ConsumeLater


class FeedbackSourceBase(BaseModel):
    class Config:
        extra = "ignore"
        keep_untouched = (cached_property,)

    @property
    def text(self) -> str:
        """Verbatim text passed to the explorer agent in the prompt."""
        raise NotImplementedError

    @property
    def ui_text(self) -> str | None:
        """Text shown in the UI. ``None`` means fall back to ``text``."""
        return None

    def should_queue(self, run_state: SeerRunState) -> bool:
        return True

    def should_consume(self, run_state: SeerRunState) -> bool:
        return True

    def should_trigger(self, run_state: SeerRunState) -> ConsumeTask | None:
        return ConsumeTask.Now
