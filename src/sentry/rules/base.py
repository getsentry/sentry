from __future__ import annotations

import abc
import logging
from collections.abc import Callable, MutableMapping, Sequence
from typing import TYPE_CHECKING, Any, ClassVar, NamedTuple

from sentry.models.project import Project
from sentry.notifications.types import RuleFuture
from sentry.services.eventstore.models import GroupEvent

if TYPE_CHECKING:
    from sentry.models.rule import Rule

"""
Rules apply either before an event gets stored, or immediately after.

Basic actions:

- I want to get notified when [X]
- I want to group events when [X]
- I want to scrub data when [X]

Expanded:

- I want to get notified when an event is first seen
- I want to get notified when an event is marked as a regression
- I want to get notified when the rate of an event increases by [100%]
- I want to get notified when an event has been seen more than [100] times
- I want to get notified when an event matches [conditions]
- I want to group events when an event matches [conditions]

Rules get broken down into two phases:

- An action
- A rule condition

A condition itself may actually be any number of things, but that is determined
by the rule's logic. Each rule condition may be associated with a form.

- [ACTION:I want to get notified when] [RULE:an event is first seen]
- [ACTION:I want to group events when] [RULE:an event matches [FORM]]
"""


# Encapsulates a reference to the callback, including arguments. The `key`
# attribute may be specifically used to key the callbacks when they are
# collated during rule processing.
class CallbackFuture(NamedTuple):
    callback: Callable[[GroupEvent, Sequence[RuleFuture]], None]
    kwargs: dict[str, Any]
    key: str | None


class RuleBase(abc.ABC):
    logger = logging.getLogger("sentry.rules")

    def __init__(
        self,
        project: Project,
        data: MutableMapping[str, Any] | None = None,
        rule: Rule | None = None,
    ) -> None:
        self.project = project
        self.data = data or {}
        self.had_data = data is not None
        self.rule = rule

    id: ClassVar[str]
    label: ClassVar[str]
    rule_type: ClassVar[str]

    def is_enabled(self) -> bool:
        return True

    def get_option(self, key: str, default: str | None = None) -> Any:
        return self.data.get(key, default)

    def render_label(self) -> str:
        return self.label.format(**self.data)

    def future(
        self,
        callback: Callable[[GroupEvent, Sequence[RuleFuture]], None],
        key: str | None = None,
        **kwargs: Any,
    ) -> CallbackFuture:
        return CallbackFuture(callback=callback, key=key, kwargs=kwargs)
