from __future__ import annotations

import abc
import logging
from collections.abc import Generator

from sentry.eventstore.models import GroupEvent
from sentry.models.rule import Rule
from sentry.rules.base import CallbackFuture, EventState, RuleBase

logger = logging.getLogger("sentry.rules")


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

    def send_confirmation_notification(self, rule: Rule, new: bool):
        """
        Send a notification confirming that a rule was created or edited
        """
        pass
