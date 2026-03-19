from __future__ import annotations

from sentry.models.group import Group
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.templates.issue import IssueNotificationData
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
)


class IssueSlackRenderer(NotificationRenderer[SlackRenderable]):
    provider_key = NotificationProviderKey.SLACK

    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        if not isinstance(data, IssueNotificationData):
            raise ValueError(f"IssueSlackRenderer does not support {data.__class__.__name__}")

        from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder

        group = Group.objects.get_from_cache(id=data.group_id)
        event = None
        if data.event_id:
            event = group.get_latest_event()

        blocks_dict = SlackIssuesMessageBuilder(
            group=group,
            event=event,
            tags=data.tags or None,
            rules=[data.rule] if data.rule else None,
            notes=data.notes or None,
        ).build(notification_uuid=data.notification_uuid)

        return SlackRenderable(
            blocks=blocks_dict.get("blocks", []),
            text=blocks_dict.get("text", ""),
        )
