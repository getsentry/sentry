from __future__ import annotations

import abc
import logging
from collections import namedtuple
from typing import Any, Callable, Dict, MutableMapping, Sequence, Type

from django import forms

from sentry.eventstore.models import GroupEvent
from sentry.models import Project, Rule
from sentry.snuba.dataset import Dataset
from sentry.types.condition_activity import ConditionActivity
from sentry.types.rules import RuleFuture

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
CallbackFuture = namedtuple("CallbackFuture", ["callback", "kwargs", "key"])


class RuleBase(abc.ABC):
    form_cls: Type[forms.Form] = None  # type: ignore

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

    @property
    @abc.abstractmethod
    def id(self) -> str:
        pass

    @property
    @abc.abstractmethod
    def label(self) -> str:
        pass

    def is_enabled(self) -> bool:
        return True

    def get_option(self, key: str, default: str | None = None) -> str:
        return self.data.get(key, default)

    def get_form_instance(self) -> forms.Form:
        data: MutableMapping[str, Any] | None = None
        if self.had_data:
            data = self.data
        return self.form_cls(data)

    def render_label(self) -> str:
        return self.label.format(**self.data)

    def validate_form(self) -> bool:
        if not self.form_cls:
            return True

        is_valid: bool = self.get_form_instance().is_valid()
        return is_valid

    def future(
        self,
        callback: Callable[[GroupEvent, Sequence[RuleFuture]], None],
        key: str | None = None,
        **kwargs: Any,
    ) -> CallbackFuture:
        return CallbackFuture(callback=callback, key=key, kwargs=kwargs)

    def get_event_columns(self) -> Dict[Dataset, Sequence[str]]:
        return {}

    def passes_activity(
        self, condition_activity: ConditionActivity, event_map: Dict[str, Any]
    ) -> bool:
        raise NotImplementedError


class EventState:
    def __init__(
        self,
        is_new: bool,
        is_regression: bool,
        is_new_group_environment: bool,
        has_reappeared: bool,
    ) -> None:
        self.is_new = is_new
        self.is_regression = is_regression
        self.is_new_group_environment = is_new_group_environment
        self.has_reappeared = has_reappeared
