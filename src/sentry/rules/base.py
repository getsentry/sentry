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

import logging
from collections import namedtuple

# Encapsulates a reference to the callback, including arguments. The `key`
# attribute may be specifically used to key the callbacks when they are
# collated during rule processing.
CallbackFuture = namedtuple("CallbackFuture", ["callback", "kwargs", "key"])


class RuleDescriptor(type):
    def __new__(cls, *args, **kwargs):
        new_cls = super().__new__(cls, *args, **kwargs)
        new_cls.id = f"{new_cls.__module__}.{new_cls.__name__}"
        return new_cls


class RuleBase(metaclass=RuleDescriptor):
    label = None
    form_cls = None

    logger = logging.getLogger("sentry.rules")

    def __init__(self, project, data=None, rule=None):
        self.project = project
        self.data = data or {}
        self.had_data = data is not None
        self.rule = rule

    def is_enabled(self):
        return True

    def get_option(self, key, default=None):
        return self.data.get(key, default)

    def get_form_instance(self):
        if self.had_data:
            data = self.data
        else:
            data = None
        return self.form_cls(data)

    def render_label(self):
        return self.label.format(**self.data)

    def validate_form(self):
        if not self.form_cls:
            return True

        form = self.get_form_instance()

        return form.is_valid()

    def future(self, callback, key=None, **kwargs):
        return CallbackFuture(callback=callback, key=key, kwargs=kwargs)


class EventState:
    def __init__(self, is_new, is_regression, is_new_group_environment, has_reappeared):
        self.is_new = is_new
        self.is_regression = is_regression
        self.is_new_group_environment = is_new_group_environment
        self.has_reappeared = has_reappeared
