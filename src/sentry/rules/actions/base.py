from __future__ import annotations

import abc
import logging
from collections.abc import Generator

from sentry.eventstore.models import GroupEvent
from sentry.models.rule import Rule
from sentry.rules.base import CallbackFuture, EventState, RuleBase
from typing import Any

logger = logging.getLogger("sentry.rules")


def instantiate_action(rule: Rule, action):
    from sentry.rules import rules

    action_cls = rules.get(action["id"])
    if action_cls is None:
        logger.warning("Unregistered action %r", action["id"])
        return None

    action_inst = action_cls(rule.project, data=action, rule=rule)
    if not isinstance(action_inst, EventAction):
        logger.warning("Unregistered action %r", action["id"])
        return None

    return action_inst


class EventAction(RuleBase, abc.ABC):
    rule_type = "action/event"

    @abc.abstractmethod
    def after(
        self, event: GroupEvent, state: EventState, notification_uuid: str | None = None
    ) -> Generator[CallbackFuture, None, None]:
        """
        Executed after a Rule matches.

        Should yield CallBackFuture instances which will then be passed into
        the given callback.

        See the notification implementation for example usage.

        Does not need to handle group state (e.g. is resolved or not)
        Caller will handle state

        >>> def after(self, event, state):
        >>>     yield self.future(self.print_results)
        >>>
        >>> def print_results(self, event, futures):
        >>>     print('Got futures for Event {}'.format(event.id))
        >>>     for future in futures:
        >>>         print(future)
        """

    def send_confirmation_notification(self, rule: Rule, new: bool, changed: dict[str, Any]):
        """
        Send a notification confirming that a rule was created or edited
        """
        pass
