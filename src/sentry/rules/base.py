"""
sentry.rules.base
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.

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

from __future__ import absolute_import

import logging
import re
import six

from collections import namedtuple
from django.utils.safestring import mark_safe

from sentry.utils.html import escape


CallbackFuture = namedtuple('CallbackFuture', ['callback', 'kwargs'])


class RuleDescriptor(type):
    def __new__(cls, *args, **kwargs):
        new_cls = super(RuleDescriptor, cls).__new__(cls, *args, **kwargs)
        new_cls.id = '%s.%s' % (new_cls.__module__, new_cls.__name__)
        return new_cls


@six.add_metaclass(RuleDescriptor)
class RuleBase(object):
    label = None
    form_cls = None

    logger = logging.getLogger('sentry.rules')

    def __init__(self, project, data=None, rule=None):
        self.project = project
        self.data = data or {}
        self.had_data = data is not None
        self.rule = rule

    def get_option(self, key):
        return self.data.get(key)

    def get_form_instance(self):
        if self.had_data:
            data = self.data
        else:
            data = None
        return self.form_cls(data)

    def render_label(self):
        return self.label.format(**self.data)

    def render_form(self):
        if not self.form_cls:
            return self.label

        form = self.get_form_instance()

        def replace_field(match):
            field = match.group(1)
            return six.text_type(form[field])

        return mark_safe(re.sub(r'{([^}]+)}', replace_field, escape(self.label)))

    def validate_form(self):
        if not self.form_cls:
            return True

        form = self.get_form_instance()

        return form.is_valid()

    def future(self, callback, **kwargs):
        return CallbackFuture(
            callback=callback,
            kwargs=kwargs,
        )


class EventState(object):
    def __init__(self, is_new, is_regression, is_sample):
        self.is_new = is_new
        self.is_regression = is_regression
        self.is_sample = is_sample,
