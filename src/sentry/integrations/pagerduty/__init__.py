from sentry.rules import rules

from .actions import PagerDutyNotifyServiceAction

rules.add(PagerDutyNotifyServiceAction)
