from __future__ import annotations

from abc import ABC
from collections.abc import Mapping, MutableMapping
from typing import Any

from sentry.eventstore.models import Event, GroupEvent
from sentry.integrations.slack.message_builder.types import SlackBody
from sentry.models.group import Group
from sentry.notifications.utils.actions import MessageAction


def get_slack_button(action: MessageAction) -> Mapping[str, Any]:
    kwargs: MutableMapping[str, Any] = {
        "text": action.label or action.name,
        "name": action.name,
        "type": action.type,
    }
    for field in ("style", "url", "value", "action_id"):
        value = getattr(action, field, None)
        if value:
            kwargs[field] = value

    if action.type == "select":
        kwargs["selected_options"] = action.selected_options or []
        kwargs["option_groups"] = action.option_groups or []

    return kwargs


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
