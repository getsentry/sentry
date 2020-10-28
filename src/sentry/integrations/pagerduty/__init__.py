from __future__ import absolute_import

from sentry.rules import rules

from .notify_action import PagerDutyNotifyServiceAction

rules.add(PagerDutyNotifyServiceAction)
