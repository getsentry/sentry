from __future__ import annotations

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
from sentry.notifications.types import TEST_NOTIFICATION_ID
from sentry.workflow_engine.tasks.utils import fetch_event


@renderer_registry.register(NotificationProviderKey.SLACK, sources=[NotificationSource.ISSUE])
class IssueSlackRenderer(NotificationRenderer[SlackRenderable]):
    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        if not isinstance(data, IssueNotificationData):
            raise ValueError(f"IssueSlackRenderer does not support {data.__class__.__name__}")

        from sentry.integrations.services.integration import integration_service
        from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
        from sentry.integrations.slack.utils.constants import SlackScope
        from sentry.integrations.slack.utils.nudge import should_send_nudge_block
        from sentry.notifications.additional_attachment_manager import get_additional_attachment

        group = Group.objects.get_from_cache(id=data.group_id)
        event = None
        if data.event_id and (fetched := fetch_event(data.event_id, group.project_id)):
            event = fetched.for_group(group)
            if data.occurrence_id:
                event.occurrence = IssueOccurrence.fetch(data.occurrence_id, group.project_id)

        integration = (
            integration_service.get_integration(integration_id=data.integration_id)
            if data.integration_id
            else None
        )
        scopes = set(integration.metadata.get("scopes") or []) if integration else set()
        send_nudge = data.rule.id != TEST_NOTIFICATION_ID and should_send_nudge_block(
            organization=group.organization, notification_uuid=data.notification_uuid
        )

        blocks_dict = SlackIssuesMessageBuilder(
            group=group,
            event=event,
            tags=set(data.tags) if data.tags else None,
            rules=[data.rule.to_notification_origin()],
            notes=data.notes,
            send_nudge=send_nudge,
            has_mentions_read_scope=SlackScope.APP_MENTIONS_READ in scopes,
        ).build(notification_uuid=data.notification_uuid)

        blocks = blocks_dict.get("blocks", [])
        if integration is not None:
            blocks.extend(get_additional_attachment(integration, group.organization) or [])

        return SlackRenderable(blocks=blocks, text=blocks_dict.get("text", ""))
