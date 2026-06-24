import logging
from collections.abc import Generator

from sentry.rules.actions.base import EventAction
from sentry.rules.base import CallbackFuture
from sentry.services.eventstore.models import GroupEvent

logger = logging.getLogger(__name__)


class NotifyEventAction(EventAction):
    """Stub for the legacy plugin notification action.

    Existing alert rules may still reference this action ID. The action
    is kept in the registry so those rules don't silently break, but it
    no longer dispatches to any plugin.
    """

    id = "sentry.rules.actions.notify_event.NotifyEventAction"
    label = "Send a notification (for all legacy integrations)"
    prompt = "Send a notification to all legacy integrations"

    def after(
        self, event: GroupEvent, notification_uuid: str | None = None
    ) -> Generator[CallbackFuture]:
        logger.info(
            "notify_event.legacy_plugin_action_noop",
            extra={
                "rule_id": self.rule.id if self.rule else None,
                "event_id": event.event_id,
                "action": self.id,
            },
        )
        yield from ()
