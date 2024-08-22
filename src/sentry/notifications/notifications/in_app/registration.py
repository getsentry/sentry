import logging
from collections.abc import Iterable, Mapping
from typing import Any

from sentry.integrations.types import ExternalProviders
from sentry.models.deploy import Deploy
from sentry.models.group import Group
from sentry.models.notificationhistory import NotificationHistory, NotificationHistoryStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notify import register_notification_provider
from sentry.types.actor import Actor

logger = logging.getLogger(__name__)


@register_notification_provider(ExternalProviders.IN_APP)
def send_in_app_personal_notification(
    notification: BaseNotification,
    recipients: Iterable[Actor],
    shared_context: Mapping[str, Any],
    extra_context_by_actor: Mapping[Actor, Mapping[str, Any]] | None,
) -> None:
    """Send an "activity" or "alert rule" notification to a Slack user or team, but NOT to a channel directly.
    Sending Slack notifications to a channel is in integrations/slack/actions/notification.py"""
    extra_context = extra_context_by_actor if extra_context_by_actor is not None else {}
    for recipient in recipients:
        recipient_context = extra_context.get(recipient.id, {})
        ctx = get_notification_content(shared_context, recipient_context)
        ctx["_actions"] = notification.get_actions(
            recipient=recipient, provider=ExternalProviders.IN_APP
        )

        if ctx is not None:
            logger.warning("in_app.swallow_ctx", extra={"recipient": recipient, "ctx": ctx})
        title = notification.get_notification_title(
            provider=ExternalProviders.IN_APP,
            context=shared_context,
        )
        description = notification.get_message_description(
            recipient=recipient, provider=ExternalProviders.IN_APP
        )
        source = notification.notification_setting_type_enum

        logger.info(
            "in_app.personal_notification",
            extra={
                "notif_name": notification.__class__.__name__,
                "title": title,
                "description": description,
                "source": source,
                "recipient": recipient,
            },
        )
        actor = recipient.resolve()
        NotificationHistory.objects.create(
            team_id=actor.id if recipient.is_team else None,
            user_id=actor.id if recipient.is_user else None,
            title=title,
            description=description,
            status=NotificationHistoryStatus.UNREAD.value,
            source=source.value,
            content=ctx,
        )


def get_notification_content(shared, extra):
    content = {**shared, **extra}
    result = {}
    if isinstance(content.get("project"), Project):
        project = content["project"]
        result["project"] = {
            "id": project.id,
            "slug": project.slug,
            "name": project.name,
        }
    if isinstance(content.get("organization"), Organization):
        organization = content["organization"]
        result["organization"] = {
            "id": organization.id,
            "slug": organization.slug,
            "name": organization.name,
        }
    if isinstance(content.get("group"), Group):
        group = content["group"]
        result["group"] = {
            "id": group.id,
            "title": group.title,
            "shortId": group.qualified_short_id,
        }

    if isinstance(content.get("deploy"), Deploy):
        deploy = content["deploy"]
        result["deploy"] = {
            "id": deploy.id,
            "release_id": deploy.release_id,
            "environment_id": deploy.environment_id,
            "name": deploy.name,
            "url": deploy.url,
        }

    if isinstance(content.get("release"), Release):
        release = content["release"]
        result["release"] = {
            "id": release.id,
            "date_added": release.date_added,
            "url": release.url,
            "ref": release.ref,
            "version": release.version,
        }

    return result
