from __future__ import annotations

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group
from sentry.notifications.platform.discord.provider import DiscordRenderable
from sentry.notifications.platform.registry import renderer_registry
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.service import NotificationRenderError
from sentry.notifications.platform.templates.issue import IssueNotificationData
from sentry.notifications.platform.tracking import NotificationLinkDecorator
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationSource,
)
from sentry.workflow_engine.tasks.utils import fetch_event


@renderer_registry.register(NotificationProviderKey.DISCORD, sources=[NotificationSource.ISSUE])
class IssueDiscordRenderer(NotificationRenderer[DiscordRenderable]):
    @classmethod
    def render[DataT: NotificationData](
        cls,
        *,
        data: DataT,
        rendered_template: NotificationRenderedTemplate,
        link_decorator: NotificationLinkDecorator,
    ) -> DiscordRenderable:
        if not isinstance(data, IssueNotificationData):
            raise ValueError(f"IssueDiscordRenderer does not support {data.__class__.__name__}")

        from sentry.integrations.discord.message_builder.issues import DiscordIssuesMessageBuilder

        # Retrieving Group and Event data is an anti-pattern, do not do this
        # in permanent renderers.
        try:
            group = Group.objects.get_from_cache(id=data.group_id)
        except Group.DoesNotExist:
            raise NotificationRenderError(f"Group {data.group_id} not found")

        group_event = None
        if data.event_id:
            try:
                event = fetch_event(data.event_id, group.project_id)
                if event is not None:
                    group_event = event.for_group(group)
                    if data.occurrence_id:
                        group_event.occurrence = IssueOccurrence.fetch(
                            data.occurrence_id, group.project_id
                        )
            except Exception:
                raise NotificationRenderError(f"Failed to retrieve event {data.event_id}")

        rules = [data.rule.to_notification_origin()] if data.rule else []

        return DiscordIssuesMessageBuilder(
            group=group,
            event=group_event,
            tags=set(data.tags) if data.tags else None,
            rules=rules,
            link_decorator=link_decorator,
        ).build(notification_uuid=data.notification_uuid)
