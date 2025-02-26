from collections.abc import Iterable, Mapping
from typing import Any

from sentry.integrations.types import ExternalProviders
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notify import register_notification_provider
from sentry.types.actor import Actor


@register_notification_provider(ExternalProviders.FAKE_LOG)
def send_fake_log_alert_notification(
    notification: BaseNotification,
    recipients: Iterable[Actor],
    shared_context: Mapping[str, Any],
    extra_context_by_actor: Mapping[Actor, Mapping[str, Any]] | None,
):
    pass
