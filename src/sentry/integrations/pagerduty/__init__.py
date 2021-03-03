from sentry.rules import rules

from .notify_action import PagerDutyNotifyServiceAction

rules.add(PagerDutyNotifyServiceAction)
