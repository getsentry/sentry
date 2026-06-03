from sentry import analytics


@analytics.eventclass("issue.view.attribution")
class IssueViewAttribution(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    feature: str
    referrer: str
    user_id: int | None
