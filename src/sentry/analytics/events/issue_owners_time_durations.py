from sentry import analytics


class IssueOwnersTimeDurationsEvent(analytics.Event):
    type = "issue_owners.time_durations"

    attributes = (
        analytics.Attribute("group_id"),
        analytics.Attribute("event_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("baseline_duration", type=int),
        analytics.Attribute("experiment_duration", type=int),
    )


analytics.register(IssueOwnersTimeDurationsEvent)
