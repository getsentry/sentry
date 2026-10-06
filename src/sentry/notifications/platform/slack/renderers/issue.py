from __future__ import annotations

from sentry import eventstore
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group
from sentry.notifications.platform.registry import renderer_registry
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.templates.issue import IssueNotificationData
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationSource,
)
from sentry.services.eventstore.models import Event


@renderer_registry.register(NotificationProviderKey.SLACK, sources=[NotificationSource.ISSUE])
class IssueSlackRenderer(NotificationRenderer[SlackRenderable]):
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
            event = eventstore.backend.get_event_by_id(
                group.project.id, data.event_id, group_id=group.id
            )
            if isinstance(event, Event):
                event = event.for_group(group)
            if event is not None and data.occurrence_id:
                event.occurrence = IssueOccurrence.fetch(data.occurrence_id, group.project_id)

        blocks_dict = SlackIssuesMessageBuilder(
            group=group,
            event=event,
            tags=set(data.tags) if data.tags else None,
            rules=[data.rule.to_rule()] if data.rule else None,
            notes=data.notes,
        ).build(notification_uuid=data.notification_uuid)

        return SlackRenderable(
            blocks=blocks_dict.get("blocks", []),
            text=blocks_dict.get("text", ""),
        )
