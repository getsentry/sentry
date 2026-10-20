from sentry.rules.filters.base import EventFilter


class IssueOccurrencesFilter(EventFilter):
    id = "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter"
    form_fields = {"value": {"type": "number", "placeholder": 10}}
    label = "The issue has happened at least {value} times"
    prompt = "The issue has happened at least {x} times (Note: this is approximate)"
