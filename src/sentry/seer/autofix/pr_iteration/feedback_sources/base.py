from __future__ import annotations

from functools import cached_property

from pydantic import BaseModel

from sentry.seer.agent.client_models import SeerRunState


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

    def should_trigger(self, run_state: SeerRunState) -> bool:
        return True
