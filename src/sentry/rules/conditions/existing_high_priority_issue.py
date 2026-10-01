from sentry.rules.conditions.base import EventCondition


class ExistingHighPriorityIssueCondition(EventCondition):
    id = "sentry.rules.conditions.high_priority_issue.ExistingHighPriorityIssueCondition"
    label = "Sentry marks an existing issue as high priority"
