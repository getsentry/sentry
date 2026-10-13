from sentry.rules.conditions.base import EventCondition


class NewHighPriorityIssueCondition(EventCondition):
    id = "sentry.rules.conditions.high_priority_issue.NewHighPriorityIssueCondition"
    label = "Sentry marks a new issue as high priority"
