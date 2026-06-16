from __future__ import annotations

from sentry import eventstore
from sentry.integrations.discord.message_builder.issues import DiscordIssuesMessageBuilder
from sentry.models.group import Group
from sentry.notifications.platform.discord.provider import DiscordRenderable
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.service import NotificationRenderError
from sentry.notifications.platform.templates.issue import IssueNotificationData
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
)
from sentry.services.eventstore.models import Event


class IssueDiscordRenderer(NotificationRenderer[DiscordRenderable]):
    provider_key = NotificationProviderKey.DISCORD

    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> DiscordRenderable:
        if not isinstance(data, IssueNotificationData):
            raise ValueError(f"IssueDiscordRenderer does not support {data.__class__.__name__}")

        # Retrieving Group and Event data is an anti-pattern, do not do this
        # in permanent renderers.
        try:
            group = Group.objects.get_from_cache(id=data.group_id)
        except Group.DoesNotExist:
            raise NotificationRenderError(f"Group {data.group_id} not found")

        group_event = None
        if data.event_id:
            try:
                event = eventstore.backend.get_event_by_id(
                    project_id=group.project.id, event_id=data.event_id, group_id=data.group_id
                )
                if isinstance(event, Event):
                    # Discord only supports GroupEvents, and we can't guarantee
                    # the type passed by eventstore, so we convert base Events
                    # to GroupEvents.
                    group_event = event.for_group(group)
                else:
                    group_event = event
            except Exception:
                raise NotificationRenderError(f"Failed to retrieve event {data.event_id}")

        rules = [data.rule.to_rule()] if data.rule else []

        return DiscordIssuesMessageBuilder(
            group=group,
            event=group_event,
            tags=set(data.tags) if data.tags else None,
            rules=rules,
            link_to_event=True,
        ).build(notification_uuid=data.notification_uuid)
