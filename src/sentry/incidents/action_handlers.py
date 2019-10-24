from __future__ import absolute_import

import abc

import six

from sentry.incidents.models import AlertRuleTriggerAction


@six.add_metaclass(abc.ABCMeta)
class ActionHandler(object):
    def __init__(self, action, incident):
        self.action = action
        self.incident = incident

    @abc.abstractmethod
    def fire(self):
        pass

    @abc.abstractmethod
    def resolve(self):
        pass


@AlertRuleTriggerAction.register_type_handler(AlertRuleTriggerAction.Type.EMAIL)
class EmailActionHandler(ActionHandler):
    def fire(self):
        pass

    def resolve(self):
        pass
