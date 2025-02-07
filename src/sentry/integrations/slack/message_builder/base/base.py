from __future__ import annotations

from abc import ABC

from sentry.eventstore.models import Event, GroupEvent
from sentry.integrations.slack.message_builder.types import SlackBody
from sentry.models.group import Group


class SlackMessageBuilder(ABC):
    def build(self) -> SlackBody:
        """Abstract `build` method that all inheritors must implement."""
        raise NotImplementedError

    def build_fallback_text(self, obj: Group | Event | GroupEvent, project_slug: str) -> str:
        """Fallback text is used in the message preview popup."""
        title = obj.title
        if isinstance(obj, GroupEvent) and obj.occurrence is not None:
            title = obj.occurrence.issue_title

        return f"[{project_slug}] {title}"
