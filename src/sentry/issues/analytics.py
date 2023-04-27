from sentry import analytics


class IssueForecastSaved(analytics.Event):
    type = "issue_forecasts.saved"

    attributes = (analytics.Attribute("num_groups"),)


class IssueEscalating(analytics.Event):
    type = "issue.escalating"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id"),
    )


analytics.register(IssueForecastSaved)
